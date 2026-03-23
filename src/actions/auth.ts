'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function signUp(formData: FormData) {
  const fullName = formData.get('fullName') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const companyName = formData.get('companyName') as string

  if (!fullName || !email || !password || !companyName) {
    return { error: 'Todos os campos são obrigatórios.' }
  }

  const supabase = await createClient()

  // 1. Create the auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  })

  if (authError) {
    return { error: authError.message }
  }

  if (!authData.user) {
    return { error: 'Erro ao criar usuário.' }
  }

  // 2. Create the company using admin client (bypasses RLS)
  const admin = createAdminClient()
  const slug = companyName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    + '-' + Date.now().toString(36)

  const { data: company, error: companyError } = await admin
    .from('companies')
    .insert({ name: companyName, slug })
    .select('id')
    .single()

  if (companyError) {
    return { error: `Erro ao criar empresa: ${companyError.message}` }
  }

  // 3. Update the user's profile with the company_id
  const { error: profileError } = await admin
    .from('profiles')
    .update({ company_id: company.id })
    .eq('id', authData.user.id)

  if (profileError) {
    return { error: `Erro ao vincular perfil: ${profileError.message}` }
  }

  return { success: true }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
