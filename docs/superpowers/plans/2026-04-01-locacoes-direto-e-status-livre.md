# Locações Diretas e Status Livre — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir criação de locações confirmadas diretamente (sem passar por orçamento) e liberar alteração de status em qualquer estado.

**Architecture:** O formulário de orçamentos (`/orcamentos/novo`) recebe `?mode=locacao` via query param — nesse modo, chama `createRental()` em vez de `createQuote()`. O badge de status na tela de detalhe da locação vira um dropdown que permite qualquer transição.

**Tech Stack:** Next.js 15+ (App Router), TypeScript, Supabase, Tailwind CSS, lucide-react

**Spec:** `docs/superpowers/specs/2026-04-01-locacoes-direto-e-status-livre.md`

---

## Chunk 1: Backend — freight em createRental + mensagem WhatsApp rental

### Task 1: Adicionar campo `freight` ao `createRental()`

**Files:**
- Modify: `src/actions/rentals.ts` — interface + insert + cálculo de total

O campo `freight` existe na tabela `rentals` (confirmado via `convertQuoteToRental` que o copia), mas não está na interface nem no insert manual.

- [ ] **Step 1.1: Adicionar `freight` à interface `CreateRentalInput`**

Em `src/actions/rentals.ts`, localizar a interface (linha ~14):
```typescript
interface CreateRentalInput {
  customer_id?: string | null
  customer_name: string
  customer_phone?: string | null
  customer_email?: string | null
  customer_document?: string | null
  event_date: string
  event_address?: string | null
  event_city?: string | null
  event_state?: string | null
  event_zip_code?: string | null
  delivery_time?: string | null
  pickup_time?: string | null
  notes?: string | null
  discount?: number
  freight?: number   // ← ADICIONAR esta linha
  items: RentalItemInput[]
}
```

- [ ] **Step 1.2: Atualizar cálculo do total em `createRental()`**

Localizar as linhas ~71-73:
```typescript
// ANTES:
const subtotal = input.items.reduce((sum, item) => sum + item.subtotal, 0)
const discount = input.discount || 0
const total = subtotal - discount
```
Substituir por:
```typescript
// DEPOIS:
const subtotal = input.items.reduce((sum, item) => sum + item.subtotal, 0)
const discount = input.discount || 0
const freight = input.freight || 0
const total = subtotal - discount + freight
```

- [ ] **Step 1.3: Adicionar `freight` ao objeto de insert**

No `.insert({...})` do supabase (~linha 94), adicionar logo após `discount`:
```typescript
discount,
freight,           // ← ADICIONAR
total,
```

- [ ] **Step 1.4: Verificar que não quebrou nada — build rápido**
```bash
cd "c:/Users/GouveiaRx/Downloads/Project Leo"
npx tsc --noEmit 2>&1 | head -30
```
Esperado: sem erros de tipo relacionados a `rentals.ts`.

- [ ] **Step 1.5: Commit**
```bash
git add src/actions/rentals.ts
git commit -m "feat: adiciona campo freight ao createRental"
```

---

### Task 2: Adicionar `generateRentalConfirmationMessage()` ao whatsapp.ts

**Files:**
- Modify: `src/lib/whatsapp.ts`

- [ ] **Step 2.1: Adicionar tipo `RentalLike` e a função**

No final de `src/lib/whatsapp.ts` (após a função `getWhatsAppUrl`), adicionar:

```typescript
type RentalLike = {
  customer_name: string
  event_date: string
  event_address?: string | null
  event_city?: string | null
  event_state?: string | null
  delivery_time?: string | null
  pickup_time?: string | null
  notes?: string | null
  total: number
  discount?: number | null
  freight?: number | null
}

export function generateRentalConfirmationMessage(
  rental: RentalLike,
  items: QuoteItemLike[],
  company: Partial<Company> & { name: string }
): string {
  const itemLines = items
    .map(
      (item, i) =>
        `${i + 1}. ${item.product_name} — Qtd: ${item.quantity} x ${formatCurrency(item.unit_price)} = ${formatCurrency(item.subtotal)}`
    )
    .join('\n')

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0)

  let message = `*${company.name}*\n`
  message += `──────────────────\n`
  message += `*LOCAÇÃO CONFIRMADA* ✅\n\n`
  message += `*Cliente:* ${rental.customer_name}\n`
  message += `*Data do Evento:* ${formatDate(rental.event_date)}\n`

  if (rental.event_address) {
    const addressParts = [
      rental.event_address,
      rental.event_city,
      rental.event_state,
    ].filter(Boolean)
    message += `*Local:* ${addressParts.join(', ')}\n`
  }

  if (rental.delivery_time) {
    message += `*Entrega:* ${rental.delivery_time}\n`
  }
  if (rental.pickup_time) {
    message += `*Retirada:* ${rental.pickup_time}\n`
  }

  message += `\n*Itens:*\n${itemLines}\n\n`
  message += `*Subtotal:* ${formatCurrency(subtotal)}\n`

  if (rental.discount && rental.discount > 0) {
    message += `*Desconto:* ${formatCurrency(rental.discount)}\n`
  }

  if (rental.freight && rental.freight > 0) {
    message += `*Frete:* ${formatCurrency(rental.freight)}\n`
  }

  message += `*TOTAL: ${formatCurrency(rental.total)}*\n\n`

  if (rental.notes) {
    message += `*Obs:* ${rental.notes}\n\n`
  }

  message += `Locação confirmada! Aguardamos você no dia do evento. 😊`

  return message
}
```

- [ ] **Step 2.2: Verificar tipos**
```bash
npx tsc --noEmit 2>&1 | head -30
```
Esperado: sem erros.

- [ ] **Step 2.3: Commit**
```bash
git add src/lib/whatsapp.ts
git commit -m "feat: adiciona generateRentalConfirmationMessage ao whatsapp.ts"
```

---

## Chunk 2: Locações page + formulário mode=locacao

### Task 3: Atualizar link "Nova Locação" em locacoes/page.tsx

**Files:**
- Modify: `src/app/(dashboard)/dashboard/locacoes/page.tsx` — linha ~200

- [ ] **Step 3.1: Alterar o href do link**

Localizar (linha ~200):
```tsx
<Link href="/dashboard/orcamentos/novo">
```
Substituir por:
```tsx
<Link href="/dashboard/orcamentos/novo?mode=locacao">
```

- [ ] **Step 3.2: Commit**
```bash
git add "src/app/(dashboard)/dashboard/locacoes/page.tsx"
git commit -m "feat: Nova Locação aponta para modo locacao"
```

---

### Task 4: Adicionar modo `locacao` ao formulário orcamentos/novo

**Files:**
- Modify: `src/app/(dashboard)/dashboard/orcamentos/novo/page.tsx`

Este é o maior change. O arquivo usa `useSearchParams` já (linha 34).

- [ ] **Step 4.1: Adicionar imports de createRental e generateRentalConfirmationMessage**

Na linha 6 (imports de actions):
```typescript
// ANTES:
import { createQuote, updateQuote, convertQuoteToRental } from '@/actions/quotes'
```
```typescript
// DEPOIS:
import { createQuote, updateQuote, convertQuoteToRental } from '@/actions/quotes'
import { createRental } from '@/actions/rentals'
```

Na linha 7 (import de whatsapp):
```typescript
// ANTES:
import { generateQuoteMessage, getWhatsAppUrl } from '@/lib/whatsapp'
```
```typescript
// DEPOIS:
import { generateQuoteMessage, generateRentalConfirmationMessage, getWhatsAppUrl } from '@/lib/whatsapp'
```

- [ ] **Step 4.2: Adicionar detecção do modo após a linha `const isEditing = Boolean(editId)` (~linha 36)**

```typescript
const isLocacao = searchParams.get('mode') === 'locacao'
```

- [ ] **Step 4.3: Alterar título e subtítulo da página**

Localizar o heading da página (buscar por `"Novo Orçamento"` no arquivo). Trocar para renderização condicional:

```tsx
// ANTES (exemplo aproximado):
<h1 className="...">Novo Orçamento</h1>
<p className="...">Crie um novo orçamento para seu cliente</p>
```
```tsx
// DEPOIS:
<h1 className="...">
  {isLocacao ? 'Nova Locação' : 'Novo Orçamento'}
</h1>
<p className="...">
  {isLocacao
    ? 'Crie uma nova locação confirmada para seu cliente'
    : 'Crie um novo orçamento para seu cliente'}
</p>
```

- [ ] **Step 4.4: Adaptar a função `handleSave` para suportar mode=locacao**

Localizar `handleSave` (linha ~279). Após a validação e antes de `setLoading(true)`, adicionar a lógica condicional:

```typescript
async function handleSave() {
  if (!customerName || !eventDate || items.length === 0) {
    alert('Preencha o cliente, data do evento e adicione pelo menos um item.')
    return
  }

  setLoading(true)

  if (isLocacao) {
    // Modo locação: cria rental confirmado diretamente
    const rentalData = {
      customer_id: selectedCustomerId,
      customer_name: customerName,
      customer_phone: customerPhone || undefined,
      customer_email: customerEmail || undefined,
      event_date: eventDate,
      event_address: eventAddress || undefined,
      event_city: eventCity || undefined,
      event_state: eventState || undefined,
      event_zip_code: eventZip || undefined,
      delivery_time: deliveryTime || undefined,
      pickup_time: pickupTime || undefined,
      notes: notes || undefined,
      discount,
      freight,
      items,
    }
    const result = await createRental(rentalData)
    if (result.error) {
      alert(result.error)
      setLoading(false)
      return
    }
    router.push('/dashboard/locacoes/' + result.id)
    return
  }

  // Modo orçamento: lógica original
  const quoteData = {
    // ... (manter código existente)
  }
  // ... resto do handleSave existente
}
```

**IMPORTANTE:** Não remover o código do `handleSave` original. Apenas envolver com `if (isLocacao) { ... return } ` antes do bloco existente.

- [ ] **Step 4.5: Adaptar os botões de ação (linhas ~748-824)**

Localizar a seção `{/* Actions */}`. Dentro do bloco `!isEditing`, adaptar os botões:

```tsx
{/* Botão salvar: muda label conforme modo */}
<Button disabled={loading} onClick={handleSave}>
  <Save className="h-4 w-4" />
  {loading
    ? 'Salvando...'
    : isLocacao
    ? 'Confirmar Locação'
    : 'Salvar Rascunho'}
</Button>

{/* Botão WhatsApp: muda label e handler conforme modo */}
<Button
  onClick={async () => {
    if (!customerName || !eventDate || items.length === 0) {
      alert('Preencha o cliente, data do evento e adicione pelo menos um item.')
      return
    }
    if (!customerPhone) {
      alert('Informe o telefone do cliente para enviar via WhatsApp.')
      return
    }
    setLoading(true)

    if (isLocacao) {
      // Modo locação
      const rentalData = {
        customer_id: selectedCustomerId,
        customer_name: customerName,
        customer_phone: customerPhone || undefined,
        customer_email: customerEmail || undefined,
        event_date: eventDate,
        event_address: eventAddress || undefined,
        event_city: eventCity || undefined,
        event_state: eventState || undefined,
        event_zip_code: eventZip || undefined,
        delivery_time: deliveryTime || undefined,
        pickup_time: pickupTime || undefined,
        notes: notes || undefined,
        discount,
        freight,
        items,
      }
      const result = await createRental(rentalData)
      if (result.error) {
        alert(result.error)
        setLoading(false)
        return
      }
      if (company) {
        const rentalObj = {
          customer_name: customerName,
          event_date: eventDate,
          event_address: eventAddress,
          event_city: eventCity,
          event_state: eventState,
          delivery_time: deliveryTime,
          pickup_time: pickupTime,
          notes,
          total,
          discount,
          freight,
        }
        const message = generateRentalConfirmationMessage(rentalObj, items, company)
        const url = getWhatsAppUrl(customerPhone, message)
        window.open(url, '_blank')
      }
      router.push('/dashboard/locacoes/' + result.id)
      return
    }

    // Modo orçamento — manter código original existente aqui
    // (o bloco que chama createQuote e generateQuoteMessage)
  }}
  disabled={loading}
>
  <MessageCircle className="h-4 w-4" />
  {loading
    ? 'Salvando...'
    : isLocacao
    ? 'Confirmar e Enviar WhatsApp'
    : 'Salvar e Enviar WhatsApp'}
</Button>
```

**IMPORTANTE:** Manter o bloco do handler de WhatsApp original (que usa `createQuote`) no `else` / no caminho normal quando `!isLocacao`.

- [ ] **Step 4.6: Verificar tipos e build**
```bash
npx tsc --noEmit 2>&1 | head -40
```
Esperado: sem erros.

- [ ] **Step 4.7: Commit**
```bash
git add "src/app/(dashboard)/dashboard/orcamentos/novo/page.tsx"
git commit -m "feat: modo locacao no formulario de orcamento"
```

---

## Chunk 3: Status dropdown na tela de detalhe

### Task 5: Status badge → dropdown em locacoes/[id]/page.tsx

**Files:**
- Modify: `src/app/(dashboard)/dashboard/locacoes/[id]/page.tsx`

- [ ] **Step 5.1: Verificar import de `updateRentalStatus` e adicionar ícones**

`updateRentalStatus` já está importado na linha ~9: `import { updateRentalStatus, ... } from '@/actions/rentals'` — confirmar que está lá.

Na linha de imports do lucide-react (~linha 21), adicionar `ChevronDown` e `Check`:
```typescript
// ANTES (linha ~21-37):
import {
  ArrowLeft,
  Truck,
  RotateCcw,
  XCircle,
  Trash2,
  ...
  Edit,
  MessageCircle,
} from 'lucide-react'
```
```typescript
// DEPOIS — adicionar ChevronDown e Check à lista:
import {
  ArrowLeft,
  Truck,
  RotateCcw,
  XCircle,
  Trash2,
  ...
  Edit,
  MessageCircle,
  ChevronDown,
  Check,
} from 'lucide-react'
```

- [ ] **Step 5.2: Adicionar imports de React**

Na linha 1:
```typescript
// ANTES:
import { useState, useEffect, useCallback, useRef } from 'react'
```
`useRef` já está importado — confirmar que está lá. Se não estiver, adicionar.

- [ ] **Step 5.3: Adicionar estado `statusDropdownOpen` e `statusDropdownRef`**

Após as outras declarações de estado (~linha 68), adicionar:
```typescript
const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
const statusDropdownRef = useRef<HTMLDivElement>(null)
```

- [ ] **Step 5.4: Adicionar `useEffect` para fechar o dropdown ao clicar fora**

Após os outros `useEffect` existentes no componente, adicionar:
```typescript
useEffect(() => {
  function handleClickOutside(event: MouseEvent) {
    if (
      statusDropdownRef.current &&
      !statusDropdownRef.current.contains(event.target as Node)
    ) {
      setStatusDropdownOpen(false)
    }
  }
  document.addEventListener('mousedown', handleClickOutside)
  return () => document.removeEventListener('mousedown', handleClickOutside)
}, [])
```

- [ ] **Step 5.5: Adicionar função `handleStatusChange`**

Após a função `handleStatusAdvance` existente (~linha 118), adicionar:
```typescript
async function handleStatusChange(newStatus: string) {
  if (!rental || newStatus === rental.status) {
    setStatusDropdownOpen(false)
    return
  }
  setStatusDropdownOpen(false)
  setActionLoading(true)
  const result = await updateRentalStatus(id, newStatus as Rental['status'])
  if (result.error) {
    alert(result.error)
  } else {
    await loadData()
  }
  setActionLoading(false)
}
```

- [ ] **Step 5.6: Substituir o badge `<span>` pelo dropdown**

Localizar (linhas ~461-465):
```tsx
<span
  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusConfig.classes}`}
>
  {statusConfig.label}
</span>
```

Substituir por:
```tsx
<div className="relative inline-flex" ref={statusDropdownRef}>
  <button
    onClick={() => setStatusDropdownOpen((o) => !o)}
    disabled={actionLoading}
    className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 ${statusConfig.classes}`}
  >
    {statusConfig.label}
    <ChevronDown className="h-3 w-3" />
  </button>
  {statusDropdownOpen && (
    <div className="absolute left-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
        <button
          key={key}
          onClick={() => handleStatusChange(key)}
          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          {cfg.label}
          {key === rental.status && (
            <Check className="ml-auto h-3 w-3 text-zinc-500" />
          )}
        </button>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 5.7: Verificar tipos e build**
```bash
npx tsc --noEmit 2>&1 | head -40
```
Esperado: sem erros.

- [ ] **Step 5.8: Commit**
```bash
git add "src/app/(dashboard)/dashboard/locacoes/[id]/page.tsx"
git commit -m "feat: status badge vira dropdown editavel na tela de locacao"
```

---

## Chunk 4: Verificação e Push

### Task 6: Verificação manual + build final

- [ ] **Step 6.1: Build de produção**
```bash
cd "c:/Users/GouveiaRx/Downloads/Project Leo"
npm run build 2>&1 | tail -30
```
Esperado: `✓ Compiled successfully` sem erros.

- [ ] **Step 6.2: Checklist de verificação manual**

Testar em desenvolvimento (`npm run dev`):

1. **Nova Locação via locações:**
   - Ir em `/dashboard/locacoes`
   - Clicar "Nova Locação"
   - Confirmar URL: `/dashboard/orcamentos/novo?mode=locacao`
   - Confirmar título da página: "Nova Locação"
   - Confirmar botão: "Confirmar Locação"
   - Preencher e salvar → deve redirecionar para `/dashboard/locacoes/{id}` com status "Confirmada"

2. **Orçamento não mudou:**
   - Ir em `/dashboard/orcamentos` → "Novo Orçamento"
   - Confirmar URL: `/dashboard/orcamentos/novo` (sem query param)
   - Confirmar título: "Novo Orçamento", botão: "Salvar Rascunho"

3. **Status dropdown:**
   - Abrir qualquer locação
   - Clicar no badge de status → dropdown deve abrir com 4 opções
   - Status atual deve ter checkmark
   - Abrir locação com status "Entregue" → mudar para "Confirmada" → deve funcionar
   - Abrir locação com status "Cancelada" → mudar status → deve funcionar

---

### Task 7: Push para o repositório

- [ ] **Step 7.1: Verificar status do git**
```bash
git log --oneline -5
git status
```

- [ ] **Step 7.2: Push**
```bash
git push origin main
```

---

### Task 8: Mensagem para Leo (cliente)

Após o push, enviar esta mensagem para Leonardo Flores via WhatsApp:

```
Oi Leo! 👋

Implementei as melhorias que você pediu no LokAgenda:

✅ *Nova Locação direto como Confirmada*
Agora quando você clica em "Nova Locação" na aba de Locações, o formulário salva diretamente como locação *confirmada* — sem precisar passar pelo orçamento. O botão ficou "Confirmar Locação".

O fluxo de orçamento continua igual: você cria o orçamento, o cliente aprova, e aí converte para locação normalmente.

✅ *Alterar status de qualquer locação*
O badge de status (Confirmada / Entregue / Devolvida / Cancelada) agora é um dropdown. Você consegue alterar o status para qualquer opção, mesmo que a locação já esteja como Entregue ou Cancelada.

Qualquer dúvida é só chamar! 🚀
```

---

## Resumo dos arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/actions/rentals.ts` | Adiciona `freight` à interface e ao insert |
| `src/lib/whatsapp.ts` | Adiciona `generateRentalConfirmationMessage()` |
| `src/app/(dashboard)/dashboard/locacoes/page.tsx` | Link Nova Locação: `?mode=locacao` |
| `src/app/(dashboard)/dashboard/orcamentos/novo/page.tsx` | Detecção `isLocacao`, botões e save condicional |
| `src/app/(dashboard)/dashboard/locacoes/[id]/page.tsx` | Badge status → dropdown |
