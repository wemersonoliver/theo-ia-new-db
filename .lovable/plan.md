

# Plano: Sistema de Cadastro de Produtos

## Resumo
Criar um módulo de produtos com CRUD completo, importação via planilha (CSV/XLSX), e vinculação aos deals do CRM. A IA poderá consultar os produtos na base de conhecimento.

## 1. Banco de Dados

**Tabela `products`:**
- `id` (uuid, PK), `user_id` (uuid, RLS), `name` (text), `description` (text), `quantity` (int, default 0), `price_cents` (int), `sku` (text, opcional), `active` (bool, default true), `created_at`, `updated_at`
- RLS: `auth.uid() = user_id`

**Tabela `crm_deal_products`** (vinculação N:N):
- `id` (uuid, PK), `deal_id` (uuid), `product_id` (uuid), `quantity` (int, default 1), `unit_price_cents` (int), `created_at`
- RLS: via `user_id` herdado do deal (ou coluna própria `user_id`)

## 2. Nova Página: Produtos (`/products`)

- Listagem em tabela com busca e filtro
- Modal de criação/edição com campos: nome, descrição, quantidade, valor
- Botão de importação via planilha (CSV parsing com `Papa Parse` ou leitura nativa)
  - Upload de arquivo CSV
  - Preview dos dados antes de confirmar
  - Mapeamento automático de colunas (nome, descrição, quantidade, valor)
- Ações: editar, excluir, ativar/desativar

## 3. Integração com CRM

- No `DealDialog`, adicionar seção para vincular produtos ao deal
- Select/multiselect de produtos com quantidade e valor unitário
- Exibir valor total dos produtos no deal card

## 4. Integração com IA

- Na edge function `whatsapp-ai-agent`, consultar tabela `products` do usuário para que a IA possa informar sobre disponibilidade, preços e descrições

## 5. Sidebar

- Adicionar item "Produtos" com ícone `Package` no menu de navegação

## Arquivos

| Arquivo | Ação |
|---------|------|
| Migration SQL (2 tabelas) | Criar |
| `src/pages/Products.tsx` | Criar |
| `src/hooks/useProducts.ts` | Criar |
| `src/components/products/ProductDialog.tsx` | Criar |
| `src/components/products/ProductImport.tsx` | Criar |
| `src/components/crm/DealDialog.tsx` | Editar (vincular produtos) |
| `src/components/Sidebar.tsx` | Editar (novo item) |
| `src/App.tsx` | Editar (nova rota) |
| `supabase/functions/whatsapp-ai-agent/index.ts` | Editar (consultar produtos) |

