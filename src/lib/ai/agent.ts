import { createAdminClient } from '@/lib/supabase/admin'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
// Modelo rápido e barato para chats de lead em alto volume.
const AI_MODEL = 'claude-haiku-4-5-20251001'
const MAX_HISTORY_MESSAGES = 10
const MAX_PRODUCTS = 30

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string
}

export type CampaignContactStatus = 'lead' | 'contacted' | 'qualified' | 'converted' | 'lost'

export interface AiReplyResult {
  reply: string
  // No modo campanha, a IA reclassifica o lead. `undefined` = sem mudança de status.
  status?: CampaignContactStatus
}

/**
 * Gera uma resposta da IA (Claude) para uma mensagem recebida de um lead no WhatsApp.
 *
 * Retorna `{ reply, status? }`, ou `null` quando:
 *  - O agente de IA não está habilitado para a empresa.
 *  - A ANTHROPIC_API_KEY não está configurada (degrada silenciosamente).
 *  - Ocorre qualquer erro (sempre tratado para não derrubar o webhook).
 */
export async function generateAiReply(
  companyId: string,
  contactPhone: string,
  incomingMessage: string,
  options?: { campaignPrompt?: string | null }
): Promise<AiReplyResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    // Sem chave configurada: não responde, mas não quebra.
    console.warn('[AI Agent] ANTHROPIC_API_KEY não configurada, ignorando resposta automática.')
    return null
  }

  const admin = createAdminClient()

  // Modo CAMPANHA (venda do sistema LokAgenda para outros locadores): usa o
  // script da campanha como cérebro. Modo PADRÃO (atendimento ao cliente final):
  // qualifica locação e usa o catálogo de produtos.
  const isCampaignMode = !!options?.campaignPrompt?.trim()

  try {
    // 1. Carregar a empresa. No modo padrão exige ai_agent_enabled;
    //    no modo campanha a própria campanha já habilitou a IA.
    const { data: company, error: companyError } = await admin
      .from('companies')
      .select('name, ai_agent_enabled, ai_agent_prompt')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      console.error('[AI Agent] Empresa não encontrada:', companyId)
      return null
    }

    if (!isCampaignMode && !company.ai_agent_enabled) {
      return null
    }

    // 2. Histórico recente da conversa (memória) — vale para os dois modos.
    const { data: history } = await admin
      .from('ai_conversations')
      .select('role, content')
      .eq('company_id', companyId)
      .eq('contact_phone', contactPhone)
      .order('created_at', { ascending: false })
      .limit(MAX_HISTORY_MESSAGES)

    const conversationHistory: AnthropicMessage[] = (history || [])
      .reverse()
      .map((m) => ({ role: m.role, content: m.content }))

    // 3. Montar o system prompt conforme o modo.
    let systemPrompt: string

    if (isCampaignMode) {
      // Venda do SISTEMA LokAgenda para donos de locadoras (B2B).
      const baseSales = `Você é um assistente de vendas da LokAgenda — um aplicativo/sistema de gestão para empresas que alugam brinquedos e equipamentos para festas. Você conversa pelo WhatsApp com o DONO de uma locadora, para apresentar o sistema e despertar interesse.

Diretrizes:
- Português do Brasil, tom amigável e consultivo. Mensagens CURTAS (WhatsApp), uma ideia por vez.
- Vá apresentando aos poucos, de forma natural — nunca despeje tudo numa mensagem só. Faça perguntas pra manter o papo.
- Primeiro entenda a realidade dele: pergunte se já usa algum app/sistema pra controlar agenda, locações, contratos e financeiro.
- Mesmo que ele já use algo, apresente os diferenciais do LokAgenda com leveza (agenda visual, contratos automáticos, controle de disponibilidade por data, financeiro, orçamento e disparo pelo WhatsApp).
- No máximo 1 emoji por mensagem. Nada de robótico ou texto de vendas agressivo.
- Quando o lead demonstrar interesse, ofereça um teste gratuito e siga as instruções da campanha (incluindo enviar o link do vídeo, se houver).
- Se ele não tiver interesse, agradeça com educação e encerre.
- Quando o lead estiver quente (quer testar/assinar/saber preço), diga que vai chamar um atendente humano pra dar sequência.`

      const script = `\n\nScript e instruções desta campanha (siga à risca):\n${options!.campaignPrompt!.trim()}`
      const statusInstruction = `\n\n[CONTROLE INTERNO — NUNCA mostre isto ao lead] Ao FINAL de cada resposta, em uma linha separada e sozinha, inclua exatamente uma tag de status do lead, escolhida pela conversa até aqui:
- <status>qualified</status> — confirmou que tem/trabalha com locação de brinquedos ou equipamentos (é o público-alvo) e está aberto a conversar.
- <status>converted</status> — quer testar, assinar, contratar ou pediu preço.
- <status>lost</status> — sem interesse, pediu para não receber mais mensagens, ou disse que não é locador.
- <status>contacted</status> — ainda em conversa, sem sinal claro (use este por padrão).
Inclua a tag SEMPRE, sozinha na última linha. O sistema remove a tag antes de enviar — o lead NUNCA a vê.`
      systemPrompt = `${baseSales}${script}${statusInstruction}`
    } else {
      // Atendimento ao cliente final da locadora (modo original).
      const { data: products } = await admin
        .from('products')
        .select('name, price, description')
        .eq('company_id', companyId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(MAX_PRODUCTS)

      const productLines =
        products && products.length > 0
          ? products
              .map((p) => {
                const price = `R$ ${Number(p.price).toFixed(2).replace('.', ',')}`
                const desc = p.description ? ` — ${p.description}` : ''
                return `- ${p.name}: ${price}${desc}`
              })
              .join('\n')
          : 'Nenhum produto cadastrado no momento.'

      const baseInstructions = `Você é um assistente de vendas e qualificação de leads da empresa "${company.name}", que aluga equipamentos e brinquedos para festas e eventos.

Diretrizes:
- Responda sempre em português do Brasil (pt-BR), de forma amigável, calorosa e concisa (mensagens curtas, adequadas ao WhatsApp).
- Seu objetivo é qualificar o lead: descubra a data do evento, o tipo de evento e o local/cidade.
- Ofereça produtos do catálogo abaixo quando fizer sentido, mencionando preços.
- Quando o lead demonstrar interesse, peça para ele confirmar os detalhes para que um atendente humano dê sequência ao orçamento.
- Não invente produtos ou preços que não estejam na lista. Se não souber algo, diga que um atendente vai verificar.
- Não use emojis em excesso (no máximo um ou dois por mensagem).`

      const customPrompt = company.ai_agent_prompt?.trim()
        ? `\n\nInstruções personalizadas da empresa:\n${company.ai_agent_prompt.trim()}`
        : ''

      const productsSection = `\n\nCatálogo de produtos disponíveis:\n${productLines}`

      systemPrompt = `${baseInstructions}${customPrompt}${productsSection}`
    }

    // 5. Montar as mensagens (histórico + mensagem nova).
    const messages: AnthropicMessage[] = [
      ...conversationHistory,
      { role: 'user', content: incomingMessage },
    ]

    // 6. Chamar a API da Anthropic.
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      const errBody = await response.text().catch(() => '')
      console.error('[AI Agent] Erro da API Anthropic:', response.status, errBody)
      return null
    }

    const data = await response.json().catch(() => null)
    const rawReply: string | undefined = data?.content
      ?.filter((block: { type: string }) => block.type === 'text')
      ?.map((block: { text: string }) => block.text)
      ?.join('\n')
      ?.trim()

    if (!rawReply) {
      console.error('[AI Agent] Resposta vazia da API Anthropic.')
      return null
    }

    // No modo campanha a IA emite uma tag <status>...</status> de controle interno.
    // Extraímos o status e REMOVEMOS qualquer tag do texto antes de enviar (o lead nunca a vê).
    let status: CampaignContactStatus | undefined
    let reply = rawReply
    if (isCampaignMode) {
      const match = rawReply.match(/<status>\s*(lead|contacted|qualified|converted|lost)\s*<\/status>/i)
      if (match) {
        status = match[1].toLowerCase() as CampaignContactStatus
      }
      reply = rawReply.replace(/<status>[\s\S]*?<\/status>/gi, '').trim()
    }

    if (!reply) {
      // Caso raro: resposta só com a tag. Não envia mensagem vazia, mas preserva o status.
      console.warn('[AI Agent] Resposta vazia após remover a tag de status.')
      return status ? { reply: '', status } : null
    }

    // 7. Persistir a mensagem do usuário e a resposta do assistente (memória).
    await admin.from('ai_conversations').insert([
      { company_id: companyId, contact_phone: contactPhone, role: 'user', content: incomingMessage },
      { company_id: companyId, contact_phone: contactPhone, role: 'assistant', content: reply },
    ])

    return { reply, status }
  } catch (err) {
    console.error('[AI Agent] Erro ao gerar resposta:', err)
    return null
  }
}
