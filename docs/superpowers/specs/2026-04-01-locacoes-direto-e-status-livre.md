# Spec: Locações Diretas e Status Livre

**Data:** 2026-04-01  
**Solicitante:** Gouveia (desenvolvedor) / Leo (cliente)  
**Status:** Aprovado pelo usuário

---

## Contexto

O sistema LokAgenda apresenta três problemas relatados pelo cliente:

1. **Nova Locação cria um Orçamento:** Ao clicar em "Nova Locação" na aba de locações, o sistema redireciona para o formulário de orçamentos e salva como status `pending` (rascunho), quando na verdade a locação já está confirmada pelo cliente.
2. **Status bloqueado:** Uma vez que uma locação fica como "Entregue" ou "Cancelada", não é possível corrigir o status — mesmo quando foi um erro do usuário.
3. **Comunicação ao cliente:** Leo precisa ser informado das novas funcionalidades.

---

## Mudança 1 — Nova Locação cria rental confirmado diretamente

### Comportamento atual
`Nova Locação` → `/dashboard/orcamentos/novo` → salva como `quote` com status `pending`

### Comportamento novo
`Nova Locação` → `/dashboard/orcamentos/novo?mode=locacao` → salva como `rental` com status `confirmed`

### Implementação

**`src/app/(dashboard)/dashboard/locacoes/page.tsx`**  
Alterar o link do botão "Nova Locação":
- De: `href="/dashboard/orcamentos/novo"`
- Para: `href="/dashboard/orcamentos/novo?mode=locacao"`

**`src/app/(dashboard)/dashboard/orcamentos/novo/page.tsx`**  
Adicionar detecção de modo via `searchParams`:
- `const isLocacao = searchParams.get('mode') === 'locacao'`
- Título: "Nova Locação" (quando `isLocacao`)
- Subtítulo: "Crie uma nova locação confirmada para seu cliente"
- Botão "Salvar Rascunho" → "Confirmar Locação" (quando `isLocacao`)
- Botão "Salvar e Enviar WhatsApp" → "Confirmar e Enviar WhatsApp" (quando `isLocacao`)
- `handleSave()`: quando `isLocacao`, chama `createRental()` em vez de `createQuote()`, redireciona para `/dashboard/locacoes/{id}`
- Handler WhatsApp: quando `isLocacao`, chama `createRental()` + `generateRentalConfirmationMessage()`, redireciona para `/dashboard/locacoes/{id}`

**`src/actions/rentals.ts`**  
Adicionar campo `freight?: number` à interface `CreateRentalInput` (linha ~15) e ao objeto de criação do rental (na query de insert, adicionar `freight: data.freight ?? 0`).

**`src/lib/whatsapp.ts`**  
Adicionar função `generateRentalConfirmationMessage()` — similar a `generateQuoteMessage()` mas com:
- Cabeçalho: `*LOCAÇÃO CONFIRMADA*`
- Rodapé: `Locação confirmada! Aguardamos você no dia do evento. 😊`

### Restrição importante
O `createRental()` valida disponibilidade de estoque. Se um produto não tiver estoque disponível na data, retornará erro — comportamento correto e desejado.

---

## Mudança 2 — Fluxo de Orçamento sem alterações

O formulário de orçamentos (`/dashboard/orcamentos/novo` sem `?mode=locacao`) permanece idêntico.  
Botões, lógica de save e redirecionamento não são alterados.

---

## Mudança 3 — Status livre via dropdown no badge

### Comportamento atual
Status "Entregue" e "Cancelada" são terminais. Não há como reverter.

### Comportamento novo
O badge de status no detalhe da locação vira um dropdown clicável.  
Qualquer status pode ser alterado para qualquer outro status.

### Implementação

**`src/app/(dashboard)/dashboard/locacoes/[id]/page.tsx`**

- Adicionar state: `const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)`
- Adicionar imports: `ChevronDown`, `Check` do `lucide-react`
- Substituir o `<span>` do badge por um `<div className="relative inline-flex">` com:
  - `<button>` com o label e ícone `ChevronDown` que abre o dropdown
  - `<div>` dropdown com 4 opções (Confirmada, Entregue, Devolvida, Cancelada)
  - Ao selecionar, chama `updateRentalStatus(id, novoStatus)` e recarrega dados
  - Status atual marcado com `<Check />`
- Fechar dropdown ao clicar fora (usar `useEffect` com listener no `document` via `mousedown`)
- Manter os botões de fluxo rápido existentes (Marcar como Entregue, Cancelar) — não remover

**Mapeamento de status:**
| Valor no DB | Label PT | Cor |
|---|---|---|
| `confirmed` | Confirmada | blue |
| `delivered` | Entregue | yellow |
| `returned` | Devolvida | green |
| `cancelled` | Cancelada | red |

**Estrutura HTML do dropdown (simplificada):**
```tsx
<div className="relative inline-flex" ref={dropdownRef}>
  <button onClick={() => setStatusDropdownOpen(o => !o)} 
    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer ${statusConfig.classes}`}>
    {statusConfig.label}
    <ChevronDown className="h-3 w-3" />
  </button>
  {statusDropdownOpen && (
    <div className="absolute left-0 top-full z-50 mt-1 w-40 rounded-lg border bg-white shadow-lg dark:bg-zinc-800 dark:border-zinc-700">
      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
        <button key={key} onClick={() => handleStatusChange(key)} 
          className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700">
          {cfg.label}
          {key === rental.status && <Check className="ml-auto h-3 w-3" />}
        </button>
      ))}
    </div>
  )}
</div>
```
`useRef` para o wrapper + `useEffect` para fechar ao clicar fora.

---

## Mensagem para o cliente (Leo)

Mensagem no estilo WhatsApp para enviar a Leonardo Flores explicando as novas funcionalidades:

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

## Arquivos críticos a modificar

| Arquivo | Mudança |
|---|---|
| `src/app/(dashboard)/dashboard/locacoes/page.tsx` | Link Nova Locação: adicionar `?mode=locacao` |
| `src/app/(dashboard)/dashboard/orcamentos/novo/page.tsx` | Detectar mode=locacao, ajustar título/botões/save |
| `src/actions/rentals.ts` | Verificar/adicionar campo `freight` em `CreateRentalInput` |
| `src/lib/whatsapp.ts` | Adicionar `generateRentalConfirmationMessage()` |
| `src/app/(dashboard)/dashboard/locacoes/[id]/page.tsx` | Badge status → dropdown clicável |

---

## Verificação

1. Ir em Locações → clicar "Nova Locação" → formulário aparece com título "Nova Locação" e botão "Confirmar Locação"
2. Preencher e salvar → deve redirecionar para `/dashboard/locacoes/{id}` com status "Confirmada"
3. Ir em Orçamentos → clicar "Novo Orçamento" → formulário normal com "Salvar Rascunho" (sem mudança)
4. Abrir uma locação com status "Entregue" → clicar no badge → dropdown aparece → selecionar "Confirmada" → status muda
5. Abrir uma locação com status "Cancelada" → mesmo teste → funciona
