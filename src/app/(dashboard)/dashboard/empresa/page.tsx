'use client'

import { useState, useEffect, useTransition } from 'react'
import { Building2, Save, Upload, Image } from 'lucide-react'
import { updateCompany } from '@/actions/company'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function EmpresaPage() {
  const [isPending, startTransition] = useTransition()
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)

  const [form, setForm] = useState({
    name: '',
    document: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    logo_url: '',
  })

  useEffect(() => {
    async function loadCompany() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) {
        setLoading(false)
        return
      }

      const { data: company } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile.company_id)
        .single()

      if (company) {
        setForm({
          name: company.name || '',
          document: company.document || '',
          phone: company.phone || '',
          email: company.email || '',
          address: company.address || '',
          city: company.city || '',
          state: company.state || '',
          zip_code: company.zip_code || '',
          logo_url: company.logo_url || '',
        })
        if (company.logo_url) {
          setLogoPreview(company.logo_url)
        }
      }

      setLoading(false)
    }

    loadCompany()
  }, [])

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setLogoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  function handleChange(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setToast(null)

    const formData = new FormData()
    formData.set('name', form.name)
    formData.set('document', form.document)
    formData.set('phone', form.phone)
    formData.set('email', form.email)
    formData.set('address', form.address)
    formData.set('city', form.city)
    formData.set('state', form.state)
    formData.set('zip_code', form.zip_code)
    if (logoFile) {
      formData.set('logo', logoFile)
    }

    startTransition(async () => {
      const result = await updateCompany(formData)
      if (result?.error) {
        setToast({ type: 'error', message: result.error })
      } else {
        setToast({ type: 'success', message: 'Dados da empresa atualizados com sucesso!' })
      }
    })
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-700" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Toast */}
      {toast && (
        <div
          className={`mb-6 rounded-lg border p-4 text-sm ${
            toast.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400'
              : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Dados da Empresa</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Atualize as informações da sua empresa.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Logo */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Logo da Empresa</h2>
          <div className="flex items-center gap-6">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Logo da empresa"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Image className="h-8 w-8 text-zinc-400" />
              )}
            </div>
            <div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700">
                <Upload className="h-4 w-4" />
                Enviar Logo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoChange}
                />
              </label>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                PNG, JPG ou SVG. Tamanho máximo de 2MB.
              </p>
            </div>
          </div>
        </div>

        {/* Company Info */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-6 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Informações Gerais</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input
                label="Nome da Empresa"
                value={form.name}
                onChange={handleChange('name')}
                placeholder="Nome da empresa"
                required
              />
            </div>
            <Input
              label="CNPJ/CPF"
              value={form.document}
              onChange={handleChange('document')}
              placeholder="00.000.000/0000-00"
            />
            <Input
              label="Telefone"
              value={form.phone}
              onChange={handleChange('phone')}
              placeholder="(00) 00000-0000"
            />
            <div className="sm:col-span-2">
              <Input
                label="E-mail"
                type="email"
                value={form.email}
                onChange={handleChange('email')}
                placeholder="contato@empresa.com"
              />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-6 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Endereço</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input
                label="Endereço"
                value={form.address}
                onChange={handleChange('address')}
                placeholder="Rua, número, complemento"
              />
            </div>
            <Input
              label="Cidade"
              value={form.city}
              onChange={handleChange('city')}
              placeholder="Cidade"
            />
            <Input
              label="Estado"
              value={form.state}
              onChange={handleChange('state')}
              placeholder="UF"
            />
            <Input
              label="CEP"
              value={form.zip_code}
              onChange={handleChange('zip_code')}
              placeholder="00000-000"
            />
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            <Save className="h-4 w-4" />
            {isPending ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </form>
    </div>
  )
}
