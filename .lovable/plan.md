

# Plano: Tela de Boas-Vindas (Onboarding Guiado)

## Resumo
Criar um fluxo de onboarding step-by-step para novos usuarios, sem sidebar, guiando-os pelos passos essenciais antes de liberar o painel completo.

## 1. Banco de Dados

**Adicionar coluna `onboarding_completed` na tabela `profiles`:**
- Tipo: `boolean`, default `false`
- Quando todos os passos forem concluidos, atualizar para `true`

## 2. Novo Componente: `Onboarding.tsx`

Tela fullscreen (sem sidebar/DashboardLayout) com:
- Barra de progresso no topo mostrando o passo atual
- Checklist lateral resumido dos passos
- Area principal com o conteudo do passo ativo

**Passos do fluxo:**

| Passo | Titulo | Comportamento |
|-------|--------|---------------|
| 1 | Boas-vindas | Mensagem de boas-vindas + explicacao da ferramenta + botao "Comecar" |
| 2 | Conectar WhatsApp | Embeds do componente de QR Code existente (reutiliza logica de `WhatsApp.tsx`). Botao "Proximo" habilitado quando status = "connected" |
| 3 | Agendamentos | Pergunta se trabalha com agendamentos. Se SIM -> mostra componente de configuracao de horarios (reutiliza `AppointmentSettings`). Se NAO -> pula para passo 4 |
| 4 | Entrevista IA | Texto explicativo + embeds do `InterviewTab` existente. Ao concluir entrevista, avanca automaticamente |
| 5 | Local de atendimento | Pergunta se tem local publico. Se SIM -> mostra `LocationPicker`. Se NAO -> pula |
| 6 | Testar Prompt | Area de teste do prompt gerado (reutiliza componente de teste existente) |
| 7 | Concluido | Tela de parabens + botao "Ir para o Painel" que marca `onboarding_completed = true` |

## 3. Logica de Redirecionamento

- No `Dashboard.tsx` (ou `ProtectedRoute`), verificar `profiles.onboarding_completed`
- Se `false`, redirecionar para `/onboarding`
- Se `true`, exibir dashboard normal
- Rota `/onboarding` adicionada no `App.tsx`

## 4. Reutilizacao de Componentes

Os componentes existentes serao extraidos/adaptados para funcionar tanto standalone quanto dentro do onboarding:
- QR Code connection de `WhatsApp.tsx`
- Configuracao de slots de `AppointmentSettings.tsx`
- `InterviewTab` de `AIAgent.tsx`
- `LocationPicker` existente
- Area de teste de prompt de `AIAgent.tsx`

## Arquivos

| Arquivo | Acao |
|---------|------|
| Migration SQL (add `onboarding_completed` to profiles) | Criar |
| `src/pages/Onboarding.tsx` | Criar |
| `src/App.tsx` | Editar (nova rota `/onboarding`) |
| `src/pages/Dashboard.tsx` | Editar (redirect se onboarding incompleto) |
| `src/integrations/supabase/types.ts` | Atualizar (novo campo) |

## Detalhes Tecnicos

- Estado do passo atual gerenciado via `useState` local
- Cada passo e um componente/secao condicional dentro de `Onboarding.tsx`
- Respostas de sim/nao (agendamentos, local) controlam quais passos sao exibidos ou pulados
- O progresso visual usa o componente `Progress` existente
- A verificacao de `onboarding_completed` e feita junto com a verificacao de acesso existente no `ProtectedRoute` ou diretamente no `Dashboard`

