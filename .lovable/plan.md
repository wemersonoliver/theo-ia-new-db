# Auditoria de Responsividade Mobile

## Objetivo
Verificar cada página e aba do sistema na largura mobile (375x812) identificando botões cortados, textos estourando, overflow horizontal, tabs ilegíveis e elementos fora da tela. Em seguida, corrigir os problemas encontrados.

## Escopo — Páginas a auditar
Rotas autenticadas principais:
1. `/dashboard` — Dashboard (KPIs, gráficos, filtros)
2. `/whatsapp` — Conexão WhatsApp (QR, status)
3. `/conversations` — Conversas (lista + chat)
4. `/contacts` — Contatos (tabela, importação)
5. `/appointments` — Agendamentos (calendário + botão "Config Horários")
6. `/appointment-settings` — Configurações de agendamento
7. `/ai-agent` — Agente IA (Gatilhos)
8. `/knowledge-base` — Base de conhecimento
9. `/crm` — CRM Kanban
10. `/tasks` — Tarefas
11. `/followup` — Follow-up
12. `/settings` — todas as sub-abas:
    - Geral / Perfil
    - Notificações
    - Configurações de IA (sub-abas: Geral, Horários, Entrevista IA, Teste de Prompt)
    - Lembretes
    - Equipe
    - Roleta
    - Base de Conhecimento
    - Assinaturas
    - Tutorial
    - Zona de Perigo
13. `/support` — Suporte
14. `/help-center` — Central de Ajuda

## Metodologia
Para cada rota:
1. `browser--navigate_to_sandbox` com viewport 375x812
2. `browser--screenshot` da tela inicial
3. Para páginas com abas/sub-abas: clicar em cada aba e capturar screenshot
4. Inspecionar via `browser--observe` quando houver suspeita de overflow
5. Registrar problemas encontrados (elemento, descrição, severidade)

## Categorias de problemas a procurar
- Overflow horizontal (scroll lateral indevido)
- Botões cortados nas bordas
- Textos truncados sem ellipsis
- TabsList com abas saindo da tela (problema comum em `/settings` e `/ai-agent` que possuem muitas abas)
- Tabelas largas sem scroll container
- Diálogos/popups maiores que a viewport
- Inputs e textareas extrapolando container
- Cards com padding excessivo em mobile
- Botões de ação (toolbar) empilhados incorretamente

## Correções esperadas (padrões a aplicar)
- Envolver `TabsList` longas em scroll horizontal: `overflow-x-auto` + `flex-nowrap`
- Trocar grids fixos por `grid-cols-1 md:grid-cols-N`
- Usar `flex-col sm:flex-row` em toolbars
- Adicionar `truncate` / `min-w-0` em textos longos dentro de flex
- Tabelas dentro de `overflow-x-auto`
- Diálogos com `max-w-[95vw]` em mobile
- Reduzir padding/spacing em mobile (`p-3 sm:p-6`)

## Entrega
1. Relatório por página listando problemas encontrados (com screenshots referenciados)
2. Aplicar as correções nos arquivos afetados
3. Re-verificar via screenshot mobile após cada correção
4. Resumo final do que foi alterado

## Observação
Esta é uma auditoria ampla — pode resultar em edições em vários arquivos de páginas e componentes. Não vou alterar lógica de negócio, apenas classes Tailwind e estrutura de layout responsivo.
