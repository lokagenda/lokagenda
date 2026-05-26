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

/**
 * Gera uma resposta da IA (Claude) para uma mensagem recebida de um lead no WhatsApp.
 *
 * Retorna o texto da resposta, ou `null` quando:
 *  - O agente de IA não está habilitado para a empresa.
 *  - A ANTHROPIC_API_KEY não está configurada (degrada silenciosamente).
 *  - Ocorre qualquer erro (sempre tratado para não derrubar o webhook).
 */
export async function generateAiReply(
  companyId: string,
  contactPhone: string,
  incomingMessage: string
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    // Sem chave configurada: não responde, mas não quebra.
    console.warn('[AI Agent] ANTHROPIC_API_KEY não configurada, ignorando resposta automática.')
    return null
  }

  const admin = createAdminClient()

  try {
    // 1. Carregar a empresa e verificar se o agente está habilitado.
    const { data: company, error: companyError } = await admin
      .from('companies')
      .select('name, ai_agent_enabled, ai_agent_prompt')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      console.error('[AI Agent] Empresa não encontrada:', companyId)
      return null
    }

    if (!company.ai_agent_enabled) {
      return null
    }

    // 2. Carregar produtos ativos da empresa para dar contexto à IA.
    const { data: products } = await admin
      .from('products')
      .select('name, price, description')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(MAX_PRODUCTS)

    // 3. Carregar histórico recente da conversa (memória).
    const { data: history } = await admin
      .from('ai_conversations')
      .select('role, content')
      .eq('company_id', companyId)
      .eq('contact_phone', contactPhone)
      .order('created_at', { ascending: false })
      .limit(MAX_HISTORY_MESSAGES)

    // O histórico vem em ordem decrescente; invertemos para ordem cronológica.
    const conversationHistory: AnthropicMessage[] = (history || [])
      .reverse()
      .map((m) => ({ role: m.role, content: m.content }))

    // 4. Montar o system prompt.
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

    const systemPrompt = `${baseInstructions}${customPrompt}${productsSection}`

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
    const reply: string | undefined = data?.content
      ?.filter((block: { type: string }) => block.type === 'text')
      ?.map((block: { text: string }) => block.text)
      ?.join('\n')
      ?.trim()

    if (!reply) {
      console.error('[AI Agent] Resposta vazia da API Anthropic.')
      return null
    }

    // 7. Persistir a mensagem do usuário e a resposta do assistente (memória).
    await admin.from('ai_conversations').insert([
      { company_id: companyId, contact_phone: contactPhone, role: 'user', content: incomingMessage },
      { company_id: companyId, contact_phone: contactPhone, role: 'assistant', content: reply },
    ])

    return reply
  } catch (err) {
    console.error('[AI Agent] Erro ao gerar resposta:', err)
    return null
  }
}
