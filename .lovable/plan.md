## Objetivo

Hoje os cenários Igreen são fixos (`CENARIO1`, `CENARIO2`, `CENARIO3`) e disparados por tags com esses nomes. Vamos reestruturar para:

- **3 produtos**: Conexão Green, Conexão Telecom, Conexão Expansão
- Cada produto contém **N cenários** (adicionar/remover livremente)
- Cada cenário tem uma **tag de gatilho configurável pelo usuário** (ex: `LEAD_GREEN_QUENTE`)
- Os cenários atuais (CENARIO1/2/3) ficam preservados em **Conexão Green**

## Banco de dados

**Nova tabela `igreen_products`** (catálogo fixo, sem account_id — global):
- `key` (PK textual: `green`, `telecom`, `expansao`)
- `name`, `description`, `enabled`, `position`

Seed inicial com os 3 produtos.

**Alterações em `igreen_scenarios`**:
- Adicionar `product_key text NOT NULL DEFAULT 'green'` (FK lógica para `igreen_products.key`)
- Adicionar `trigger_tag text` — tag que dispara o cenário (substitui o uso de `scenario_key`)
- Manter `scenario_key` para compatibilidade dos 3 cenários existentes (não-nulo), mas:
  - Remover a constraint que exige só `CENARIO1/2/3` (passa a aceitar qualquer string)
  - Tornar `scenario_key` opcional para novos cenários (ou gerar automaticamente: `{product}_{n}`)
- Adicionar índice `(account_id, product_key)`
- Migração de dados: para cenários existentes, setar `product_key='green'` e `trigger_tag = scenario_key` (CENARIO1/2/3)

**Hook `useIgreenScenarios`**: novos métodos `createScenario(product_key, name)`, `deleteScenario(id)`.

## Edge functions

**`igreen-scenario-enroll`**: hoje recebe `scenario_key` (CENARIO1/2/3). Mudar para receber `trigger_tag` e localizar o cenário ativo do account cuja `trigger_tag = tag aplicada`. Manter retrocompatibilidade aceitando `scenario_key`.

**Whatsapp-webhook / código que aciona enroll por tag**: revisar o ponto onde a tag é detectada e chamar enroll com `trigger_tag` em vez de `scenario_key` fixo.

**`igreen-scenario-dispatcher`**: nenhuma mudança lógica (já trabalha por `scenario_id`).

## UI (`IgreenScenariosTab.tsx`)

Nova estrutura em **abas por produto**:

```text
[Conexão Green] [Conexão Telecom] [Conexão Expansão]
─────────────────────────────────────────────
[+ Novo cenário]
▼ Cenário "Lead Frio Green"  · tag: LEAD_FRIO  [switch]
   - Tag de gatilho: [input]   - Tag final: [...]   [Salvar]
   - Dias (editor existente)
▼ Cenário "Pós-venda" · tag: GREEN_POSVENDA ...
```

Cada cenário ganha campos:
- **Nome** (editável)
- **Tag de gatilho** (input) — substitui o badge fixo CENARIO1
- Botão **Excluir cenário**

Cenários CENARIO1/2/3 existentes aparecem em Conexão Green com `trigger_tag` pré-preenchida com o valor antigo (CENARIO1/2/3) — usuário pode trocar a tag se quiser.

## Resumo de arquivos a tocar

1. **Migration**: cria `igreen_products`, ajusta `igreen_scenarios`, faz seed/backfill.
2. `src/hooks/useIgreenScenarios.ts`: tipos + queries de produtos + create/delete cenário.
3. `src/components/igreen/IgreenScenariosTab.tsx`: layout em abas por produto + campo trigger_tag + criar/excluir.
4. `supabase/functions/igreen-scenario-enroll/index.ts`: aceitar `trigger_tag`.
5. Buscar caller(s) de `igreen-scenario-enroll` (provavelmente `whatsapp-webhook` ou similar) e ajustar payload.

## Pergunta antes de prosseguir

- A criação de cenário deve permitir o usuário **definir manualmente** a `trigger_tag`, ou ela é **gerada automaticamente** e só renomeável? → assumo **manualmente**, com validação de unicidade dentro do account.
- Confirma que **Telecom** e **Expansão** começam **vazios** (sem cenários pré-criados) e o usuário cria conforme precisar? → assumo que sim.

Posso seguir?
