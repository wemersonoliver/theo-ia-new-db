## Objetivo
- Usuários **trial** passam a ver a **dashboard básica** por padrão (igual ao plano Basic).
- No diálogo "Dashboard avançada" (já existente), trial vê um botão extra **"Testar plano Pro"**.
- Ao clicar, todas as features Pro ficam liberadas até o fim do período de teste (15 dias).

## Mudanças

### 1. Banco — flag de pro trial
Adicionar coluna em `accounts` (compartilhada por toda a equipe, igual ao trial):
```sql
ALTER TABLE public.accounts
  ADD COLUMN pro_trial_activated boolean NOT NULL DEFAULT false,
  ADD COLUMN pro_trial_activated_at timestamptz;
```
RLS atual de `accounts` já permite owner/membro ler; precisa permitir UPDATE pelo owner caso ainda não exista (validar policies; se necessário criar policy `UPDATE` para `owner_user_id = auth.uid()` somente nessas colunas via trigger ou liberar update geral do owner — manter padrão existente).

### 2. `src/hooks/useAccountPlan.ts`
- Buscar também `accounts.pro_trial_activated` + `accounts.created_at` do owner do usuário (via `account_members` → `accounts`).
- Calcular dias restantes do trial (15 dias). Se `tier === "trial"` **e** `pro_trial_activated` **e** dias restantes > 0 → tratar como **`pro`** (efetivo) para o restante da app.
- Expor também `tier` original (`baseTier: "trial"`) e `proTrialActive: boolean` para a UI mostrar mensagens corretas.

```ts
return { tier, baseTier, maxInstances, proTrialActive, proTrialDaysLeft, isLoading };
```

Como praticamente toda a app usa `tier === "pro" | "tester"` para liberar features (ex.: `WhatsApp.tsx`, `Dashboard.tsx`, etc.), elevar o tier efetivo já libera **todas** as opções Pro automaticamente — sem precisar tocar em cada feature.

### 3. `src/pages/Dashboard.tsx`
- `isBasic` passa a ser `baseTier === "basic" || baseTier === "trial"` (ambos veem dashboard reduzida quando não há pro ativo).
- Já com a mudança no hook, se trial ativou Pro Trial, `tier` vira `"pro"` → `isBasic` = false → dashboard avançada renderiza normalmente.
- No diálogo "Disponível no plano Pro":
  - Se `baseTier === "trial"` e `!proTrialActive`: exibir card/botão extra **"Testar plano Pro grátis"** com texto: *"Libere todas as funcionalidades do plano Pro até o fim do seu período de teste (`X` dias restantes)."*
  - Ao confirmar: `update accounts set pro_trial_activated=true, pro_trial_activated_at=now() where id = <account_id>`, invalidar query `useAccountPlan` (`queryClient.invalidateQueries(["account-plan"])` ou usar realtime/refetch), fechar diálogo, exibir toast de sucesso.
- Manter botões de checkout Pro Mensal/Anual e "Visualizar dashboard" (preview com mock) inalterados — preview continua disponível.

### 4. Comportamento por tier (atualizado)
| Situação                                       | Dashboard padrão | Botões no dialog                              |
|------------------------------------------------|------------------|-----------------------------------------------|
| trial (sem pro trial)                          | Básica           | Testar Pro grátis · Pro Mensal/Anual · Preview |
| trial com pro trial ativo (dentro de 15 dias)  | Avançada (real)  | — (não aparece dialog)                        |
| basic                                          | Básica           | Pro Mensal/Anual · Preview                    |
| pro / tester / super_admin                     | Avançada (real)  | — (não aparece dialog)                        |

Após expiração do trial, `ProtectedRoute` continua bloqueando acesso (CheckoutScreen), independentemente do pro trial ter sido ativado.

## Detalhes técnicos
- Acionar update via `supabase.from("accounts").update({...}).eq("id", accountId)` no clique. `accountId` obtido por `useAccount()`.
- Garantir que `useAccountPlan` invalide/refetch após mutation (usar `useMutation` + `queryClient.invalidateQueries({ queryKey: ["account-plan", ...] })`; renomear queryKey existente do hook se necessário para uma key estável).
- Não criar fluxo de "desativar" pro trial — uma vez ativado fica até expirar com o trial.
- Sem mudanças em `KPICards` (já recebe `variant`).

## Arquivos afetados
- Migração SQL nova (accounts.pro_trial_activated/_at)
- `src/hooks/useAccountPlan.ts`
- `src/pages/Dashboard.tsx`
