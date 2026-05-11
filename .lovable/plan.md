## Objetivo

Expandir a aba **Vídeos Tutoriais** do super admin (`/admin/tutorial-videos`) para gerenciar vídeos de duas categorias separadas:

1. **Onboarding** (já existente) — passos do fluxo de cadastro
2. **Menus do sistema** (novo) — cada item da sidebar do usuário

Manter o mesmo padrão visual atual: card por item, opção de link YouTube ou upload de arquivo, e badge verde "Vídeo anexado" / "YouTube" no canto superior do card quando já houver vídeo salvo.

---

## Mudanças

### 1. `src/pages/admin/AdminTutorialVideos.tsx`

- Envolver a listagem em um `<Tabs>` de nível superior com duas guias:
  - **Onboarding** — mantém os 7 passos atuais (`welcome`, `whatsapp`, `appointments`, `interview`, `location_question`, `location`, `test_prompt`).
  - **Menus** — nova lista com os itens da sidebar usando o prefixo `menu_` para não colidir com chaves de onboarding:
    - `menu_dashboard` — Dashboard
    - `menu_conversations` — Conversas
    - `menu_whatsapp` — WhatsApp
    - `menu_ai_agent` — Agente IA
    - `menu_simulate` — Simular Atendimento
    - `menu_followup` — Follow-Up
    - `menu_crm` — CRM
    - `menu_contacts` — Contatos
    - `menu_tasks` — Tarefas
    - `menu_appointments` — Agendamentos
    - `menu_settings` — Configurações
    - `menu_help` — Central de Ajuda
    - `menu_support` — Suporte
- Extrair o conteúdo do card (atual `.map`) para um componente interno reutilizável `TutorialVideoCard` que recebe `{ key, label }` para evitar duplicação entre as duas guias.
- O badge "Vídeo anexado / YouTube" continua aparecendo automaticamente em qualquer card cujo `step_key` já tenha registro com `file_path` ou `video_url` na tabela `onboarding_tutorial_videos` (mesma tabela, mesmo hook — apenas chaves novas).

### 2. Backend / banco

Nenhuma migração necessária. A tabela `onboarding_tutorial_videos` já tem `step_key` como texto livre com unique constraint, então as novas chaves `menu_*` convivem sem conflito. O hook `useTutorialVideos` permanece igual.

### 3. Fora do escopo (não alterar agora)

- Não vou exibir esses vídeos automaticamente nas páginas de menu do usuário — o pedido é apenas pela aba de gestão no super admin, mantendo o mesmo padrão visual de "vídeo anexado". Se quiser que cada página exiba um botão "Tutorial" para o usuário final, posso fazer numa segunda etapa.

---

## Resultado esperado

Em `/admin/tutorial-videos`, o super admin vê duas abas no topo. Cada aba lista cards (um por passo/menu) com:
- Tabs internas "Link YouTube" / "Anexar Vídeo"
- Preview do vídeo quando salvo
- Badge "Vídeo anexado" / "YouTube" no header do card quando já existe upload
- Botão "Remover vídeo"