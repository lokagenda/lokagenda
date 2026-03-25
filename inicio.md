# LokAgenda — Documentação do Projeto

## Fase 1 — Base completa do sistema (R$ 3.150) ✅ ENTREGUE

**Status:** Concluída e aprovada pelo cliente em 24/03/2026

### Funcionalidades entregues:
- Cadastro de empresa (multiempresa, logo, dados completos)
- Cadastro de produtos/brinquedos (imagem, estoque, valor, status)
- Agenda com controle de disponibilidade automático por data E horário
- Módulo de orçamento com envio direto por WhatsApp
- Conversão de orçamento em locação (disponibilidade dinâmica por período)
- Estrutura inicial do contrato automático (com variáveis tipo {{nome_cliente}}, {{data_evento}})
- Login por usuário com acesso restrito à própria empresa
- Botão para abrir Google Maps/Waze direto no endereço da locação
- Backup automático diário e opção de exportação de dados (CSV)

### Extras implementados na Fase 1 (feedback do cliente):
- Aba de Disponibilidade (consulta rápida de itens por data/horário → gerar orçamento)
- Preço editável por item no orçamento (permite negociação)
- Campo de frete/deslocamento no orçamento e locação
- Pagamento parcial (sinal): registrar pagamentos, status pendente/parcial/pago
- Auto-save de cliente novo ao criar orçamento
- Edição de orçamento pendente (carrega dados existentes)
- Fluxo simplificado: converter orçamento direto em locação (sem etapa de aprovação)
- Dark/Light mode em todas as telas
- Paginação em todas as listagens
- Recuperação de senha e verificação de email

---

## Fase 2 — Operação e gestão (R$ 1.800) ✅ ENTREGUE

**Status:** Concluída e aprovada pelo cliente em 25/03/2026
**Início:** 25/03/2026

### 2.1 — Dashboard redesenhado (conforme layout do cliente)

O cliente enviou um layout de referência com as seguintes seções:

**Linha 1 — Banner de anúncios:**
- Banner rotativo no topo do dashboard (até 5 imagens)
- Cada imagem com link clicável (site ou WhatsApp do anunciante)
- Rotação automática entre as imagens
- Gerenciável pelo painel admin (campo para upload de imagem + URL do link)
- Mesma imagem usada como pop-up no primeiro login do dia (1x por dia por usuário)

**Linha 2 — Stats rápidos:**
- Produtos (total)
- Orçamentos Pendentes (total)
- Locações do Mês (total)
- Clientes (total)

**Linha 3 — Financeiro mensal:**
- Card "Faturamento Mensal" com valor total e % comparativo ao mês anterior
- Card "Receber" (valor total em aberto) com badge "Em aberto"
- Card "Recebido" (valor já pago) com badge "Pago"
- **Incluir valor de sinal (pagamento parcial) no "Recebido" e restante no "Receber"**
- Gráfico de faturamento mensal (linha) com seletor de mês
- Botão "+ Novo Orçamento" de acesso rápido

**Linha 4 — Listas:**
- "Próximas Locações" (lista com cliente, data, valor) com link "Ver todas"
- "Orçamentos Pendentes" (lista com cliente, data, valor) com link "Ver todos"
- Coluna lateral com "Próximas Locações" resumidas

### 2.2 — Contrato completo com editor e PDF

**Editor de modelo por empresa:**
- Editor visual de HTML do contrato (textarea com preview ao vivo)
- Variáveis dinâmicas: {{nome_cliente}}, {{cpf_cliente}}, {{data_evento}}, {{itens_locacao}}, {{valor_total}}, etc.
- Múltiplos modelos por empresa (com flag "padrão")
- CRUD completo de templates (já existe da Fase 1)

**Exportação em PDF:**
- Botão "Exportar PDF" na página da locação
- Gerar PDF do contrato preenchido com dados reais
- Download direto ou abrir em nova aba

**Assinatura digital (solicitação do cliente):**
- Campo de assinatura no contrato (desenhar com dedo/mouse na tela)
- Canvas interativo para captura da assinatura
- Assinatura salva como imagem no contrato
- Duas assinaturas: cliente + empresa (locador)
- Assinatura incluída no PDF exportado

### 2.3 — Financeiro básico

**Por locação:**
- Valor total, valor pago (sinal), valor restante (já implementado na Fase 1)
- Histórico de pagamentos com data e valor de cada registro
- Método de pagamento (PIX, dinheiro, cartão, transferência)

**Visão geral:**
- Faturamento mensal (soma de todas locações do mês)
- Contas a receber (soma de valores restantes de locações confirmadas)
- Contas recebidas (soma de amount_paid de todas locações)
- Filtro por período (mês/semana)
- Comparativo com mês anterior (%)

### 2.4 — Notificações internas

**Tipos de notificação:**
- Locação próxima (evento amanhã ou hoje)
- Pagamento pendente (locação passada sem pagamento completo)
- Orçamento vencendo (pendente há mais de X dias)

**Interface:**
- Ícone de sino no header com contador de não lidas
- Dropdown com lista de notificações
- Marcar como lida / marcar todas como lidas
- Geração automática via cron ou ao carregar o dashboard

### 2.5 — Filtros rápidos na agenda

**Filtros adicionais na página de Locações:**
- Filtro por status de pagamento (pendente/parcial/pago)
- Filtro por período (data inicial → data final)
- Busca por nome do cliente
- Filtro combinável (status + pagamento + período)

**Filtros adicionais na página de Orçamentos:**
- Busca por nome do cliente
- Filtro por período

### 2.6 — Sistema de banners e pop-up (solicitação do cliente)

**Painel admin para gerenciar anúncios:**
- Upload de até 5 imagens de banner
- Para cada imagem: URL de destino (site ou WhatsApp)
- Ativar/desativar cada banner
- Ordem de exibição

**Banner no dashboard:**
- Carrossel rotativo no topo
- Clique direciona para o link configurado
- Rotação automática a cada 5 segundos

**Pop-up no primeiro login do dia:**
- Exibe uma das imagens do banner ao fazer login
- Aparece apenas 1x por dia (salvo em localStorage)
- Botão "Fechar" e link "Saiba mais" que abre a URL

---

## Fase 3 — SaaS, monetização e admin (R$ 1.850) 🚧 EM DESENVOLVIMENTO

**Status:** Em desenvolvimento
**Prazo estimado:** 8 a 10 dias corridos
**Início:** 25/03/2026

### 3.1 — Planos e assinaturas

**Definição de planos:**
- 3 planos: Básico, Profissional, Premium
- Ciclos: mensal, semestral, anual
- Limites por plano: produtos, locações/mês, usuários
- Trial gratuito de 7 dias para novos cadastros

**Tabelas no banco:**
- `plans`: definição dos planos (nome, preço, limites, features)
- `subscriptions`: assinatura ativa por empresa (plano, status, ciclo, datas)

**Status de assinatura:** trial → active → past_due → cancelled → expired

**Lógica de bloqueio:**
- Empresa sem assinatura ativa (trial expirado) → overlay "Assine um plano"
- Limites por plano (ex: Básico = 10 produtos, 50 locações/mês, 2 usuários)

### 3.2 — Integração com Mercado Pago

**Fluxo de pagamento:**
1. Usuário escolhe plano (landing page ou /dashboard/assinatura)
2. Sistema cria preferência de pagamento no Mercado Pago
3. Usuário paga via checkout do MP
4. Webhook do MP notifica o sistema → atualiza status da assinatura
5. Se pagamento falha → status `past_due` → notificação ao usuário
6. Se cancela → bloqueia após período atual

**Liberação e bloqueio automáticos:**
- Webhook processa: payment.approved → status `active`
- Webhook processa: payment.rejected → status `past_due`
- Cron diário: verifica `current_period_end` → marca como `expired`

### 3.3 — Landing page pública

**Seções:**
1. Hero: título + subtítulo + CTA "Começar grátis"
2. Features: ícones + descrição das funcionalidades do sistema
3. Como funciona: 3 passos (cadastrar, configurar, gerenciar)
4. Planos e preços: cards comparativos com toggle mensal/anual
5. FAQ
6. CTA final + footer

**Páginas:**
- `/` — landing page principal
- `/precos` — página de planos detalhada
- Layout público sem sidebar (header + footer próprios)

### 3.4 — Sistema de anúncios ✅ JÁ IMPLEMENTADO (Fase 2)

- Banner carrossel no dashboard (rotação automática 5s) ✅
- Pop-up diário (1x por dia por usuário) ✅
- Admin de banners com tipos separados (banner retangular + popup quadrado) ✅
- Suporte a banners globais (is_global) que aparecem em todas as empresas ✅
- Até 5 imagens por tipo ✅

### 3.5 — Painel admin geral (Super Admin)

**Acesso:** Role `super_admin` no perfil do usuário

**Dashboard admin:**
- Total de empresas cadastradas
- Assinaturas ativas / trial / canceladas
- Receita mensal
- Últimos cadastros

**Gerenciamento:**
- Listar/editar/suspender empresas
- CRUD de planos (criar, editar preços, ativar/desativar)
- Ver assinaturas (filtrar por status)
- Gerenciar banners globais (aparecem em todas as empresas)
- Listar todos os usuários do sistema

---

## Informações do Projeto

**Total:** R$ 6.800
**Tecnologia:** Next.js 16 + Supabase + Tailwind CSS 4 + Vercel
**Código:** 100% do cliente, repositório GitHub privado
**Contas:** Vercel e Supabase no e-mail do cliente

**Proposta aceita em:** 20/03/2026
**Fase 1 entregue em:** 24/03/2026
**Fase 2 entregue em:** 25/03/2026
**Fase 3 início:** 25/03/2026
