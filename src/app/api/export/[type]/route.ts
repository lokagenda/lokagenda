import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { Database } from '@/types/database'

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
}

function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function buildCsv(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCsvField).join(',')
  const dataLines = rows.map((row) => row.map(escapeCsvField).join(','))
  return [headerLine, ...dataLines].join('\n')
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params

  const validTypes = ['products', 'customers', 'quotes', 'rentals']
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  }

  const supabase = await getSupabase()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) {
    return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 403 })
  }

  const companyId = profile.company_id
  let csv = ''

  if (type === 'products') {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('company_id', companyId)
      .order('name')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const headers = ['Nome', 'Descrição', 'Preço', 'Estoque', 'Status', 'Criado em']
    const rows = (data || []).map((p) => [
      p.name,
      p.description || '',
      String(p.price),
      String(p.stock),
      p.status,
      p.created_at,
    ])
    csv = buildCsv(headers, rows)
  }

  if (type === 'customers') {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('company_id', companyId)
      .order('name')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const headers = ['Nome', 'Telefone', 'E-mail', 'CPF/CNPJ', 'Endereço', 'Cidade', 'Estado', 'CEP', 'Observações', 'Criado em']
    const rows = (data || []).map((c) => [
      c.name,
      c.phone || '',
      c.email || '',
      c.document || '',
      c.address || '',
      c.city || '',
      c.state || '',
      c.zip_code || '',
      c.notes || '',
      c.created_at,
    ])
    csv = buildCsv(headers, rows)
  }

  if (type === 'quotes') {
    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const headers = ['Cliente', 'Telefone', 'E-mail', 'Data Evento', 'Endereço Evento', 'Status', 'Total', 'Desconto', 'Observações', 'Criado em']
    const rows = (data || []).map((q) => [
      q.customer_name,
      q.customer_phone || '',
      q.customer_email || '',
      q.event_date,
      q.event_address || '',
      q.status,
      String(q.total),
      String(q.discount),
      q.notes || '',
      q.created_at,
    ])
    csv = buildCsv(headers, rows)
  }

  if (type === 'rentals') {
    const { data, error } = await supabase
      .from('rentals')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const headers = ['Cliente', 'Telefone', 'E-mail', 'CPF', 'Data Evento', 'Endereço Evento', 'Entrega', 'Retirada', 'Status', 'Total', 'Desconto', 'Observações', 'Criado em']
    const rows = (data || []).map((r) => [
      r.customer_name,
      r.customer_phone || '',
      r.customer_email || '',
      r.customer_document || '',
      r.event_date,
      r.event_address || '',
      r.delivery_time || '',
      r.pickup_time || '',
      r.status,
      String(r.total),
      String(r.discount),
      r.notes || '',
      r.created_at,
    ])
    csv = buildCsv(headers, rows)
  }

  const fileNames: Record<string, string> = {
    products: 'produtos',
    customers: 'clientes',
    quotes: 'orcamentos',
    rentals: 'locacoes',
  }

  const fileName = `${fileNames[type]}_${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
