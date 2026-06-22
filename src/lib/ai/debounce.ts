import { createAdminClient } from '@/lib/supabase/admin'
import { generateAiReply } from '@/lib/ai/agent'
import { sendWhatsAppMessage } from '@/lib/whatsapp-api/sender'

// Debounce de 8s pra agrupar rajadas do cliente. Quando 3 msgs chegam em 10s,
// a IA responde 1x abraçando as 3. Cobre o caso Locador-597 (22/jun): cliente
// mandou "Oi" / "Sim" / "Data e bairro seria" e recebeu 3 respostas separadas.

const DEBOUNCE_MS = 8000
const QUIET_WINDOW_MS = 7000 // tolerancia menor pra detectar "nao chegou msg nova"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Aguarda DEBOUNCE_MS e processa todas as msgs do phone que ja tem >= 7s de idade
 * (= cliente parou de digitar). Concat texts em ordem, chama generateAiReply 1x,
 * envia resposta e marca todas como processed.
 *
 * Lock: marca processing_at antes de processar pra outras invocacoes concorrentes
 * (multiplos `after()` simultaneos) nao duplicarem.
 */
export async function processWithDebounce(phone: string): Promise<void> {
  try {
    await sleep(DEBOUNCE_MS)
    await processNow(phone)
  } catch (err) {
    console.error('[debounce] phone=' + phone, err)
  }
}

/**
 * Sem await sleep. Usado pelo cron de cleanup pra processar pendings antigas.
 */
export async function processNow(phone: string): Promise<void> {
  const admin = createAdminClient()
  const now = Date.now()
  const cutoffIso = new Date(now - QUIET_WINDOW_MS).toISOString()
  const lockedIso = new Date().toISOString()

  // 1. Lock: pega todas pendings desse phone com idade >= QUIET_WINDOW_MS
  const { data: locked, error: lockErr } = await admin
    .from('pending_inbound')
    .update({ processing_at: lockedIso })
    .eq('phone', phone)
    .is('processed_at', null)
    .is('processing_at', null)
    .lt('created_at', cutoffIso)
    .select('*')
    .order('created_at', { ascending: true })

  if (lockErr) {
    console.error('[debounce] lock erro phone=' + phone, lockErr)
    return
  }
  if (!locked || locked.length === 0) return

  // 2. Verifica se cliente ainda esta digitando (msg nova chegou nos ultimos 7s)
  const { data: newer } = await admin
    .from('pending_inbound')
    .select('id')
    .eq('phone', phone)
    .is('processed_at', null)
    .gte('created_at', cutoffIso)
    .limit(1)
    .maybeSingle()

  if (newer) {
    // Libera lock e deixa pro proximo after() que a nova msg vai disparar
    await admin
      .from('pending_inbound')
      .update({ processing_at: null })
      .in('id', locked.map((l) => l.id))
    console.log('[debounce] cliente ainda digitando phone=' + phone + ' n_locked=' + locked.length)
    return
  }

  // 3. Concat texts
  const concatText =
    locked.length === 1
      ? locked[0].text
      : locked.map((l, i) => `(${i + 1}) ${l.text}`).join('\n')

  // Pega meta da PRIMEIRA msg (campaign_prompt e contact info nao mudam dentro
  // de uma rajada do mesmo phone)
  const first = locked[0]
  if (!first.company_id) {
    // Sem company resolvida no gate inicial: nada pra fazer
    await admin
      .from('pending_inbound')
      .update({ processed_at: new Date().toISOString() })
      .in('id', locked.map((l) => l.id))
    return
  }

  // 4. Chama IA
  const aiResult = await generateAiReply(first.company_id, phone, concatText, {
    campaignPrompt: first.campaign_prompt ?? null,
  })

  // 5. Atualiza status + defesa em profundidade (mesmo do inbound)
  if (aiResult?.status && first.contact_id) {
    const offFunnel =
      aiResult.status === 'lost' || aiResult.status === 'converted'
    const update: {
      status: 'lead' | 'contacted' | 'qualified' | 'converted' | 'lost'
      updated_at: string
      ai_paused_until?: string
    } = {
      status: aiResult.status,
      updated_at: new Date().toISOString(),
    }
    if (offFunnel) {
      update.ai_paused_until = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString()
    }
    await admin.from('campaign_contacts').update(update).eq('id', first.contact_id)
  }

  // 6. Envia mensagem
  if (aiResult?.reply) {
    await sendWhatsAppMessage(phone, aiResult.reply, { companyId: first.company_id })
  }

  // 7. Marca todas como processed
  await admin
    .from('pending_inbound')
    .update({ processed_at: new Date().toISOString() })
    .in('id', locked.map((l) => l.id))

  console.log(
    '[debounce] processed phone=' + phone + ' n_msgs=' + locked.length + ' reply=' + (aiResult?.reply ? 'sim' : 'nao'),
  )
}
