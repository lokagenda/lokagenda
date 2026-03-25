'use server'

import { createClient } from '@/lib/supabase/server'
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
    horario_entrega: rental.delivery_time || '-',
    horario_retirada: rental.pickup_time || '-',
    itens_locacao: itemsHtml,
    valor_total: formatCurrency(rental.total),
    valor_desconto: formatCurrency(rental.discount),
    valor_frete: formatCurrency(rental.freight || 0),
    valor_pago: formatCurrency(rental.amount_paid || 0),
    valor_restante: formatCurrency((rental.total || 0) - (rental.amount_paid || 0)),
    status_pagamento: rental.payment_status === 'paid' ? 'Pago' : rental.payment_status === 'partial' ? 'Parcial' : 'Pendente',
    nome_empresa: company.name,
    telefone_empresa: company.phone || '-',
    cnpj_empresa: company.document || '-',
    data_atual: formatDate(new Date()),
  }

  const contractHtml = replaceVariables(template.content, data)

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
