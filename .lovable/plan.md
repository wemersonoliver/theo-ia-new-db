
# 📋 Plano: Central de Ajuda do Theo IA

## 🎯 Objetivo
Criar uma central de ajuda detalhada, voltada para público leigo, com tutoriais passo a passo, suporte a uploads de prints/screenshots e editor visual estilo Word para os admins criarem/editarem o conteúdo.

---

## 🗄️ 1. Banco de Dados (1 migração)

### Tabela `help_categories`
- `id`, `slug` (único), `name`, `description`, `icon` (nome lucide), `position`, `created_at`, `updated_at`
- RLS: leitura para qualquer autenticado; escrita apenas `super_admin`.

### Tabela `help_articles`
- `id`, `category_id`, `slug` (único), `title`, `summary`, `content` (HTML do Tiptap), `position`, `published` (bool), `created_at`, `updated_at`
- RLS: leitura para autenticados (somente `published=true`); escrita apenas `super_admin`.

### Tabela `help_article_images`
- `id`, `article_id`, `storage_path`, `caption`, `position`, `created_at`
- RLS: leitura para autenticados; escrita apenas `super_admin`.

### Bucket `help-center-images` (público para leitura)
- Policy: SELECT público; INSERT/UPDATE/DELETE apenas `super_admin`.

### Seed inicial
- 8 categorias: Primeiros Passos, WhatsApp, Agente IA, Base de Conhecimento, CRM, Agendamentos, Equipe, Assinaturas.
- ~25 artigos pré-preenchidos com texto detalhado para leigos, com placeholders `[PRINT 1]`, `[PRINT 2]` indicando onde você fará upload depois.

---

## 📦 2. Dependências
Adicionar:
- `@tiptap/react`
- `@tiptap/starter-kit`
- `@tiptap/extension-link`
- `@tiptap/extension-image`
- `@tiptap/extension-placeholder`

---

## 🎨 3. Páginas do usuário

### `/help-center` (acessível por todos: owner + equipe)
- Cabeçalho com busca global por título/conteúdo.
- Grade de cards de categorias (ícone + nome + descrição + contagem de artigos).

### `/help-center/:categorySlug`
- Lista de artigos da categoria selecionada.
- Botão "Voltar para categorias".

### `/help-center/:categorySlug/:articleSlug`
- Conteúdo HTML formatado.
- Imagens (prints) com legendas exibidas inline.
- Navegação anterior/próximo artigo.
- Botão fixo "Falar com Suporte" (WhatsApp +55 47 99129-3662).

---

## 🛠️ 4. Painel Admin: `/admin/help-center`

- **Categorias**: listar, criar, editar, excluir, reordenar (drag-and-drop).
- **Artigos** (por categoria): listar, criar, editar, excluir, reordenar, publicar/despublicar.
- **Editor de artigo**:
  - Editor WYSIWYG **Tiptap** (negrito, itálico, sublinhado, títulos H2/H3, listas, links, citações).
  - Seção dedicada para upload de prints com:
    - Upload múltiplo (drag-and-drop).
    - Legenda editável por imagem.
    - Reordenação por arrastar.
    - Excluir imagem.
- Toggle "Publicado" para esconder rascunhos dos usuários.

---

## 🧩 5. Componentes e Hooks

**Novos componentes:**
- `src/components/help/RichTextEditor.tsx` — wrapper Tiptap reutilizável.
- `src/components/help/HelpArticleEditor.tsx` — editor completo (campos + Tiptap + galeria).
- `src/components/help/HelpImageUploader.tsx` — upload e gestão de prints.
- `src/components/help/HelpArticleView.tsx` — render do artigo com prints intercalados.
- `src/components/help/HelpCategoryCard.tsx` — card de categoria.

**Novos hooks:**
- `src/hooks/useHelpCenter.ts` — leitura pública de categorias/artigos/imagens.
- `src/hooks/useHelpAdmin.ts` — CRUD admin com TanStack Query (otimista).

**Novas páginas:**
- `src/pages/HelpCenter.tsx`
- `src/pages/HelpCategory.tsx`
- `src/pages/HelpArticle.tsx`
- `src/pages/admin/AdminHelpCenter.tsx`

---

## 🔗 6. Navegação

- **Sidebar do usuário** (`src/components/Sidebar.tsx`): novo item "Central de Ajuda" com ícone `BookOpen`, visível para todos os membros (sem checagem de permissão).
- **Sidebar admin** (`src/components/admin/AdminSidebar.tsx`): novo item "Central de Ajuda" com ícone `BookOpen`.
- **App.tsx**: registrar 4 novas rotas (3 públicas autenticadas + 1 admin).

---

## 📝 7. Conteúdo inicial (exemplo do tom para leigos)

Cada artigo virá assim:

> **Título:** Conectando seu WhatsApp via QR Code
>
> **Passo 1 — Acesse a página WhatsApp**
> No menu lateral esquerdo, clique em **"WhatsApp"** (ícone do celular).
> `[PRINT 1: Menu lateral com WhatsApp destacado]`
>
> **Passo 2 — Clique em "Conectar WhatsApp"**
> ...

Você abre o painel admin depois e faz upload dos prints reais nos slots marcados.

---

## ✅ 8. Lista de arquivos a criar/editar

**Migração:** 1 arquivo SQL (tabelas + RLS + bucket + seed)

**Criar:**
- `src/pages/HelpCenter.tsx`
- `src/pages/HelpCategory.tsx`
- `src/pages/HelpArticle.tsx`
- `src/pages/admin/AdminHelpCenter.tsx`
- `src/components/help/RichTextEditor.tsx`
- `src/components/help/HelpArticleEditor.tsx`
- `src/components/help/HelpImageUploader.tsx`
- `src/components/help/HelpArticleView.tsx`
- `src/components/help/HelpCategoryCard.tsx`
- `src/hooks/useHelpCenter.ts`
- `src/hooks/useHelpAdmin.ts`

**Editar:**
- `src/App.tsx` (rotas)
- `src/components/Sidebar.tsx` (item menu)
- `src/components/admin/AdminSidebar.tsx` (item menu)
- `package.json` (deps Tiptap)

---

## ⚠️ Observações
- A Central de Ajuda **não substitui** a Base de Conhecimento da IA — são coisas separadas (esta é manual do usuário; aquela alimenta o agente).
- Após implementação, você acessa `/admin/help-center` para fazer upload dos prints reais nos artigos pré-prontos.

