'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { replaceVariables } from '@/lib/contract'
import { formatCurrency, formatDate } from '@/lib/utils'

async function getAuthenticatedProfile() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Não autorizado')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.company_id) {
    throw new Error('Perfil ou empresa não encontrados')
  }

  return { supabase, userId: user.id, companyId: profile.company_id }
}

export async function createTemplate(formData: FormData) {
  const { supabase, companyId } = await getAuthenticatedProfile()

  const name = formData.get('name') as string
  const content = formData.get('content') as string
  const isDefault = formData.get('is_default') === 'true'

  if (!name || name.trim() === '') {
    return { error: 'Nome do modelo é obrigatório.' }
  }

  if (!content || content.trim() === '') {
    return { error: 'Conteúdo do modelo é obrigatório.' }
  }

  // If this will be the default, unset any existing default
  if (isDefault) {
    await supabase
      .from('contract_templates')
      .update({ is_default: false })
      .eq('company_id', companyId)
      .eq('is_default', true)
  }

  const { error } = await supabase.from('contract_templates').insert({
    company_id: companyId,
    name: name.trim(),
    content: content,
    is_default: isDefault,
  })

  if (error) {
    return { error: `Erro ao criar modelo: ${error.message}` }
  }

  revalidatePath('/dashboard/contratos')
  redirect('/dashboard/contratos')
}

export async function updateTemplate(id: string, formData: FormData) {
  const { supabase, companyId } = await getAuthenticatedProfile()

  const name = formData.get('name') as string
  const content = formData.get('content') as string
  const isDefault = formData.get('is_default') === 'true'

  if (!name || name.trim() === '') {
    return { error: 'Nome do modelo é obrigatório.' }
  }

  if (!content || content.trim() === '') {
    return { error: 'Conteúdo do modelo é obrigatório.' }
  }

  // Verify belongs to company
  const { data: existing, error: fetchError } = await supabase
    .from('contract_templates')
    .select('id')
    .eq('id', id)
    .eq('company_id', companyId)
    .single()

  if (fetchError || !existing) {
    return { error: 'Modelo não encontrado.' }
  }

  // If this will be the default, unset any existing default
  if (isDefault) {
    await supabase
      .from('contract_templates')
      .update({ is_default: false })
      .eq('company_id', companyId)
      .eq('is_default', true)
  }

  const { error } = await supabase
    .from('contract_templates')
    .update({
      name: name.trim(),
      content: content,
      is_default: isDefault,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) {
    return { error: `Erro ao atualizar modelo: ${error.message}` }
  }

  revalidatePath('/dashboard/contratos')
  redirect('/dashboard/contratos')
}

export async function deleteTemplate(id: string) {
  const { supabase, companyId } = await getAuthenticatedProfile()

  const { error } = await supabase
    .from('contract_templates')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) {
    return { error: `Erro ao excluir modelo: ${error.message}` }
  }

  revalidatePath('/dashboard/contratos')
  redirect('/dashboard/contratos')
}

export async function generateContract(rentalId: string) {
  const { supabase, companyId } = await getAuthenticatedProfile()

  // Get the rental with items
  const { data: rental, error: rentalError } = await supabase
    .from('rentals')
    .select('*')
    .eq('id', rentalId)
    .eq('company_id', companyId)
    .single()

  if (rentalError || !rental) {
    return { error: 'Locação não encontrada.' }
  }

  // Get rental items
  const { data: items } = await supabase
    .from('rental_items')
    .select('*')
    .eq('rental_id', rentalId)

  // Get company info
  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single()

  if (!company) {
    return { error: 'Empresa não encontrada.' }
  }

  // Get the default template
  const { data: template } = await supabase
    .from('contract_templates')
    .select('content')
    .eq('company_id', companyId)
    .eq('is_default', true)
    .single()

  if (!template) {
    return { error: 'Nenhum modelo de contrato padrão definido. Crie um modelo e marque como padrão.' }
  }

  // Build items list HTML
  const itemsHtml = items && items.length > 0
    ? items.map(item =>
        `${item.quantity}x ${item.product_name} - ${formatCurrency(item.subtotal)}`
      ).join('<br/>')
    : 'Nenhum item'

  // Build the data map
  const data: Record<string, string> = {
    nome_cliente: rental.customer_name,
    cpf_cliente: rental.customer_document || '-',
    telefone_cliente: rental.customer_phone || '-',
    email_cliente: rental.customer_email || '-',
    endereco_evento: [rental.event_address, rental.event_city, rental.event_state].filter(Boolean).join(', ') || '-',
    data_evento: rental.event_date ? formatDate(rental.event_date) : '-',
    data_retirada: (rental as any).event_end_date ? formatDate((rental as any).event_end_date) : (rental.event_date ? formatDate(rental.event_date) : '-'),
    horario_entrega: rental.delivery_time || '-',
    horario_retirada: rental.pickup_time || '-',
    data_pagamento_sinal: (rental as any).payment_date_signal ? formatDate((rental as any).payment_date_signal) : '-',
    data_pagamento_total: (rental as any).payment_date_total ? formatDate((rental as any).payment_date_total) : '-',
    itens_locacao: itemsHtml,
    valor_total: formatCurrency(rental.total),
    valor_desconto: formatCurrency(rental.discount),
    valor_frete: formatCurrency(rental.freight || 0),
    valor_pago: formatCurrency(rental.amount_paid || 0),
    valor_restante: formatCurrency((rental.total || 0) - (rental.amount_paid || 0)),
    status_pagamento: rental.payment_status === 'paid' ? 'Pago' : rental.payment_status === 'partial' ? 'Parcial' : 'Pendente',
    logo_empresa: company.logo_url
      ? `<img src="${company.logo_url}" style="max-height: 80px; display: block; margin: 0 auto;" />`
      : '',
    nome_empresa: company.name,
    telefone_empresa: company.phone || '-',
    cnpj_empresa: company.document || '-',
    data_atual: formatDate(new Date()),
  }

  let contractHtml = replaceVariables(template.content, data)

  // Inject signatures ABOVE the line (border-top) in the signature area
  const sigCompany = rental.signature_company || company.signature_url
  const sigClient = rental.signature_client
  const sigImg = (src: string) => `<img src="${src}" style="max-width: 200px; height: 80px; object-fit: contain; display: block; margin: 0 auto 10px;" />`
  const sigPlaceholder = '<div style="height: 80px; margin-bottom: 10px;"></div>'

  // Add align-items: flex-end to the flex container so both columns align at bottom
  contractHtml = contractHtml.replace(
    /display:\s*flex;\s*justify-content:\s*space-between;/,
    'display: flex; justify-content: space-between; align-items: flex-end;'
  )

  // LOCADORA signature (or placeholder)
  if (sigCompany) {
    contractHtml = contractHtml.replace(
      /(<div style="border-top:\s*1px solid[^"]*"[^>]*>[\s\r\n]*<strong>LOCADORA<\/strong>)/,
      `${sigImg(sigCompany)}$1`
    )
  }

  // LOCATÁRIO signature (or placeholder to keep alignment)
  if (sigClient) {
    contractHtml = contractHtml.replace(
      /(<div style="border-top:\s*1px solid[^"]*"[^>]*>[\s\r\n]*<strong>LOCATÁRIO\(A\)<\/strong>)/,
      `${sigImg(sigClient)}$1`
    )
  }

  // Save to rental
  const { error: updateError } = await supabase
    .from('rentals')
    .update({
      contract_html: contractHtml,
      updated_at: new Date().toISOString(),
    })
    .eq('id', rentalId)
    .eq('company_id', companyId)

  if (updateError) {
    return { error: `Erro ao salvar contrato: ${updateError.message}` }
  }

  revalidatePath(`/dashboard/locacoes/${rentalId}`)
  return { success: true, html: contractHtml }
}

/**
 * Faz upload do PDF do contrato pro bucket 'contracts' e salva a URL no rental.
 *
 * Substitui o upload feito antes direto pelo browser (createBrowserClient).
 * Problema anterior: quando a sessao Supabase estava sendo refreshed no
 * momento do upload, auth.role() ficava 'anon' momentaneamente e a policy
 * RLS de storage.objects bloqueava o INSERT com "new row violates row-level
 * security policy". Cliente via erro generico "Server Components render" sem
 * saber a causa (2 clientes reportaram em 27/jul).
 *
 * Fix: recebe o PDF como base64, valida auth (getAuthenticatedProfile),
 * confirma que o rental pertence a empresa, e faz o upload via admin client
 * (service role) que bypassa RLS. Como a auth ja foi validada antes, o
 * acesso continua seguro — usuario so consegue subir PDF pra rental que
 * pertence a company dele.
 */
export async function uploadContractPdf(rentalId: string, pdfBase64: string) {
  const { supabase, companyId } = await getAuthenticatedProfile()

  const { data: rental, error: fetchError } = await supabase
    .from('rentals')
    .select('id, company_id')
    .eq('id', rentalId)
    .eq('company_id', companyId)
    .single()

  if (fetchError || !rental) {
    return { error: 'Locação não encontrada.' }
  }

  const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '')
  let pdfBuffer: Buffer
  try {
    pdfBuffer = Buffer.from(cleanBase64, 'base64')
  } catch {
    return { error: 'PDF inválido.' }
  }
  if (pdfBuffer.length === 0) {
    return { error: 'PDF vazio.' }
  }
  if (pdfBuffer.length > 20 * 1024 * 1024) {
    return { error: 'PDF muito grande (max 20MB).' }
  }

  const admin = createAdminClient()
  const filePath = `${companyId}/${rentalId}.pdf`

  const { error: uploadError } = await admin.storage
    .from('contracts')
    .upload(filePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (uploadError) {
    return { error: `Erro ao subir PDF: ${uploadError.message}` }
  }

  const { data: publicUrlData } = admin.storage.from('contracts').getPublicUrl(filePath)
  const pdfUrl = publicUrlData.publicUrl

  const { error: updateError } = await admin
    .from('rentals')
    .update({
      contract_pdf_url: pdfUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', rentalId)
    .eq('company_id', companyId)

  if (updateError) {
    return { error: `Erro ao salvar URL do PDF: ${updateError.message}` }
  }

  revalidatePath(`/dashboard/locacoes/${rentalId}`)
  return { success: true, pdfUrl }
}

export async function saveContractPdf(rentalId: string, pdfUrl: string) {
  const { supabase, companyId } = await getAuthenticatedProfile()

  // Verify rental belongs to company
  const { data: rental, error: fetchError } = await supabase
    .from('rentals')
    .select('id')
    .eq('id', rentalId)
    .eq('company_id', companyId)
    .single()

  if (fetchError || !rental) {
    return { error: 'Locação não encontrada.' }
  }

  const { error: updateError } = await supabase
    .from('rentals')
    .update({
      contract_pdf_url: pdfUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', rentalId)
    .eq('company_id', companyId)

  if (updateError) {
    return { error: `Erro ao salvar URL do PDF: ${updateError.message}` }
  }

  revalidatePath(`/dashboard/locacoes/${rentalId}`)
  return { success: true }
}

export async function saveSignatures(
  rentalId: string,
  signatureClient: string,
  signatureCompany: string
) {
  const { supabase, companyId } = await getAuthenticatedProfile()

  // Verify rental belongs to company
  const { data: rental, error: fetchError } = await supabase
    .from('rentals')
    .select('id')
    .eq('id', rentalId)
    .eq('company_id', companyId)
    .single()

  if (fetchError || !rental) {
    return { error: 'Locação não encontrada.' }
  }

  const { error: updateError } = await supabase
    .from('rentals')
    .update({
      signature_client: signatureClient,
      signature_company: signatureCompany,
      updated_at: new Date().toISOString(),
    })
    .eq('id', rentalId)
    .eq('company_id', companyId)

  if (updateError) {
    return { error: `Erro ao salvar assinaturas: ${updateError.message}` }
  }

  revalidatePath(`/dashboard/locacoes/${rentalId}`)
  return { success: true }
}
