# LokAgenda

Sistema completo para gestão de locação de brinquedos e equipamentos para festas e eventos.

## Stack

- **Next.js 16** + **TypeScript**
- **Supabase** (Auth, Database, Storage)
- **Tailwind CSS 4**
- **Vercel** (Hosting)

## Funcionalidades (Fase 1)

- Login e cadastro de usuários (multiempresa)
- Cadastro de empresa com logo e dados completos
- Catálogo de produtos com imagem, estoque, preço e status
- Cadastro de clientes com CPF e telefone
- Orçamentos com envio direto por WhatsApp
- Conversão de orçamento em locação (com impacto no estoque por horário)
- Agenda de locações com controle de disponibilidade por data e período
- Aba de Disponibilidade para consulta rápida de itens por data/horário
- Contratos automáticos com variáveis dinâmicas
- Botão Google Maps e Waze no endereço da locação
- Preço editável por item no orçamento
- Campo de frete/deslocamento
- Exportação CSV e backup automático diário
- Modo claro e escuro

## Rodando localmente

```bash
npm install
cp .env.local.example .env.local
# Preencha as variáveis do Supabase
npm run dev
```
