
## Plano Igreen Energy — Template de sistema para assinantes

Novo plano comercial "Plano Igreen Energy" que entrega template pronto: 3 cenários de cadência (acionados por tag exclusiva), fluxo personalizado livre, prompt padrão ajustável via simulador, base de conhecimento pré-carregada e tema visual verde Igreen — aplicado **somente** para assinantes desse plano.

---

### 1. Plano comercial

- Inserir 2 planos em `plans` (via insert tool após migração):
  - `igreen-monthly` — tier `igreen`, billing `monthly`, checkout `https://pay.kiwify.com.br/krlmNAg`
  - `igreen-annual` — tier `igreen`, billing `annual`, checkout `https://pay.kiwify.com.br/nxY8qSd`
  - Mesmo `price_cents` em ambos (a definir; provisório a partir do Kiwify).
- Estender `PlanTier` em `src/hooks/useAccountPlan.ts` para incluir `"igreen"`.
- Atualizar `account_plan_tier()` (já mapeia `p.tier` direto, então funciona) e `enforce_wa_instance_limit()` para permitir **2 instâncias** para tier `igreen` (basic=1, pro/tester=3, igreen=2).
- Gating de features para tier `igreen`:
  - ✅ Fluxos Personalizados
  - ✅ Cenários Igreen (nova feature, §3)
  - ✅ Base de Conhecimento (pré-populada)
  - ✅ Simular Atendimento (ajuste do prompt padrão)
  - ❌ Aba "Follow-Up IA" em `/followup` (ocultar)
  - ❌ Aba "Entrevista" em `/ai-agent` (ocultar)

### 2. Branding Igreen (escopo: somente plano Igreen)

- Manter logo do Theo no sidebar (sem troca).
- Cores extraídas do print enviado (verde Igreen + degradê + accent laranja do contorno) — converter para HSL e expor como tokens semânticos sob a classe `.theme-igreen` em `src/index.css`:
  - Verde primário, verde claro, verde escuro (degradê), accent laranja, gradientes pré-prontos.
- `DashboardLayout` aplica `document.documentElement.classList.toggle("theme-igreen", tier === "igreen")`. Demais usuários permanecem no tema atual.
- Sidebar, botões primários, badges e cabeçalhos passam a usar os tokens sobrescritos (sem refator de componente — só troca de tokens).

### 3. Cenários Igreen — nova feature

Nova aba "Cenários Igreen" em `/followup` (visível só para tier `igreen`), com 3 cenários fixos: **CENARIO1, CENARIO2, CENARIO3**.

#### 3.1 UX (menu suspenso por dia, igual print de referência)

- Cabeçalho do cenário: nome, toggle on/off, descrição opcional.
- Lista de Dias colapsáveis (Dia 1, Dia 2, …) com contador `(N mensagens)` e toggle por dia.
- Ao expandir um dia: dois blocos — **Manhã (08:00–12:00)** e **Tarde (12:00–19:55)**. Cada bloco contém uma **sequência de itens** (texto, áudio, vídeo, imagem, documento), na ordem definida, com delay em segundos/minutos entre itens.
- Botão "+ Adicionar dia" no final → permite estender além dos 7 dias iniciais para construir cadência longa (~4 meses).
- Reuso do `MediaLibraryManager` e do visual do `StepDialog` para os itens.

#### 3.2 Regras de envio

- Estrutura padrão: 7 dias × 2 envios/dia (manhã + tarde). Dias extras configuráveis livremente.
- Janelas: manhã 08:00–12:00, tarde 12:00–19:55, horários sorteados dentro de cada janela.
- **Intervalo mínimo de 3h** entre o envio da manhã e o da tarde do mesmo dia (validado no dispatcher).
- Cada envio é uma **sequência de itens** disparados em ordem, com pequenos delays entre itens (segundos/minutos).
- Acionamento: adição da tag `CENARIO1|CENARIO2|CENARIO3` ao contato (pela IA ou manualmente).
- **Tag exclusiva**: ao aplicar uma nova tag de cenário, cenários anteriores do mesmo contato são marcados como `stopped` (reason: `replaced_by_<nova_tag>`).
- Parada automática quando: contato responder, tag removida do contato, ou último dia atingido.

#### 3.3 Modelo de dados (novas tabelas)

```text
igreen_scenarios            (id, account_id, scenario_key[CENARIO1|2|3], name,
                             enabled, description, created_at, updated_at)
igreen_scenario_days        (id, scenario_id, day_number, enabled)
igreen_scenario_messages    (id, day_id, period[morning|evening], label)
igreen_scenario_items       (id, message_id, position,
                             type[text|audio|video|image|document],
                             content, media_url, media_mime, media_filename, caption,
                             delay_value, delay_unit[seconds|minutes])
igreen_scenario_enrollments (id, account_id, scenario_key, contact_phone, contact_id,
                             current_day, current_period, status[active|completed|stopped],
                             started_at, last_sent_at, next_run_at, stop_reason)
igreen_scenario_events      (id, enrollment_id, day_number, period, message_id,
                             sent_at, status, error)
```

- RLS por `account_id = current_account_id()`.
- UNIQUE `(account_id, scenario_key, contact_phone)` em enrollments para garantir exclusividade.

#### 3.4 Backend (edge functions)

- `igreen-scenario-enroll`: chamado quando uma tag de cenário é adicionada (hook em `whatsapp-ai-agent` e ação manual no app). Cria enrollment, marca outros cenários do contato como `stopped`, agenda `next_run_at` para o próximo slot válido na janela.
- `igreen-scenario-dispatcher` (pg_cron a cada 1 min): busca enrollments com `next_run_at <= now()`, monta a sequência de itens da mensagem (manhã ou tarde) e envia via `send-whatsapp-message` respeitando delays entre itens. Agenda próximo período/dia respeitando a regra de 3h e as janelas. Reuso de `_followup-window.ts`.
- Parada por resposta: `whatsapp-webhook` chama RPC `igreen_stop_for_phone(account_id, phone, reason)` quando o contato envia mensagem.

### 4. Template inicial (provisionamento ao assinar)

- Função `provision-igreen-template` (acionada pelo `kiwify-webhook` ao confirmar assinatura `tier=igreen`):
  - Garante os 3 cenários (CENARIO1/2/3) na conta — com estrutura vazia de dias para serem preenchidos depois.
  - Define prompt padrão Igreen em `whatsapp_ai_config.custom_prompt` (placeholder — conteúdo final virá depois).
  - Garante existência das tags `CENARIO1`, `CENARIO2`, `CENARIO3` no catálogo de tags da conta.
  - Idempotente.
- Documentos da base de conhecimento serão carregados manualmente pelo admin depois.

### 5. Frontend — mudanças principais

- `src/pages/Followup.tsx`: para tier `igreen`, exibir abas `[Cenários Igreen] [Fluxos Personalizados]`. Demais tiers mantêm as abas atuais.
- `src/pages/AIAgent.tsx`: para tier `igreen`, ocultar aba "Entrevista".
- `src/index.css`: adicionar `.theme-igreen { ... }` com tokens HSL extraídos do print.
- `src/components/DashboardLayout.tsx`: aplicar `.theme-igreen` na raiz quando aplicável.
- Novos componentes:
  - `src/components/igreen/IgreenScenariosTab.tsx`
  - `src/components/igreen/ScenarioAccordion.tsx` (lista de dias)
  - `src/components/igreen/DayMessagesEditor.tsx` (manhã/tarde + itens)
  - `src/components/igreen/ScenarioItemDialog.tsx`
- Novos hooks: `useIgreenScenarios.ts`, `useIgreenEnrollments.ts`.

### 6. Ordem de execução

1. Migração: tier `igreen` (apenas referência via plans), tabelas `igreen_scenario_*`, RPC `igreen_stop_for_phone`, ajuste em `enforce_wa_instance_limit` para 2 instâncias.
2. Insert tool: 2 linhas em `plans` com os checkouts Kiwify informados.
3. Tema Igreen em `index.css` + aplicação condicional no layout.
4. Gating das abas (Followup/AIAgent) por tier.
5. UI dos cenários (CRUD completo de dias/mensagens/itens).
6. Edge functions `igreen-scenario-enroll` + `igreen-scenario-dispatcher` + cron 1 min.
7. Hook em `whatsapp-webhook` para parar cenários ao receber resposta + hook em `whatsapp-ai-agent` para aplicar tag chamando enroll.
8. Hook no `kiwify-webhook` chamando `provision-igreen-template` ao confirmar plano Igreen.
9. QA com conta de teste no tier Igreen.

### Itens pendentes (resolver durante/depois)

- Conteúdo das mensagens dos 3 cenários (placeholders na entrega).
- Prompt padrão Igreen (placeholder).
- Documentos da base de conhecimento (upload manual após).
- Preço exato (mensal/anual) — confirmar valor numérico para `price_cents`.
