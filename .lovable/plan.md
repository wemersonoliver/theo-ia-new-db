## Objetivo
Substituir as 5 bolhas de texto da abertura do agente **green** (iGreen) por **2 áudios em sequência**, com indicador "gravando áudio" antes de cada um, intervalo de 10 segundos entre eles, e gerenciados por um painel admin (vale para todas as contas iGreen).

---

## 1. Banco de dados
Nova tabela global (sem `account_id` — é template padrão para toda a vertical green):

`public.igreen_default_greeting_audios`
- `id uuid pk`
- `slot int` (1 ou 2 — ordem de envio)
- `audio_url text` (URL pública do áudio no Storage)
- `transcript text` (texto da gravação — vai para o histórico da IA como contexto)
- `delay_after_ms int default 0` (slot 1 = 0, slot 2 = 10000)
- `enabled bool default true`
- `updated_at timestamptz`

Constraint `unique(slot)`. RLS: leitura para `authenticated` e `service_role`; escrita só para `super_admin` (via `has_role`).

Seed inicial com slot 1 e slot 2 vazios (URLs preenchidas depois pelo upload no admin).

## 2. Storage
Novo bucket **público** `igreen-audios` para hospedar os MP3/OGG. Sem RLS de leitura (público); upload restrito a `super_admin` via policy em `storage.objects`.

## 3. Painel admin
Nova aba em **/admin** → "Áudios iGreen (Green)":
- Lista os 2 slots (Saudação 1 / Saudação 2)
- Para cada um: player atual + botão "Substituir áudio" (upload mp3/ogg/m4a até 16 MB) + textarea com a **transcrição** + toggle ativo/inativo
- Botão "Salvar" — faz upload no bucket, atualiza `audio_url` e `transcript` na tabela
- Apenas `super_admin` acessa (igual outras rotas admin)

## 4. Edge function — mudança no agente green
Arquivo: `supabase/functions/_igreen_v2/agents/green/run.ts` (bloco `if (stage === "greet")`, linhas 140-170).

Em vez de devolver `messages: [5 strings]`, o agente vai:
1. Buscar os 2 áudios em `igreen_default_greeting_audios` (ordenados por slot, só `enabled`).
2. Se algum áudio não estiver configurado → **fallback** para o texto atual (segurança).
3. Emitir 2 `tool_calls` do tipo `send_greeting_audio` (slot 1 e slot 2) que serão executados pelo router de automações.
4. Injetar as **transcrições** no histórico/state como mensagens "from_me" da IA, para que o contexto do agente nos próximos turnos saiba o que foi falado (idêntico ao que hoje as 5 bolhas de texto representam).
5. Manter `intro_sent`, `greeted`, `explained`, `atendimento_started` no patch (como hoje).

## 5. Nova automação `greeting-audio-dispatch`
Arquivo novo: `supabase/functions/_igreen_v2/automations/greeting-audio-dispatch.ts`, registrada em `_register-all.ts`.

Por slot:
1. Envia presença **`recording`** via `POST /chat/sendPresence/{instance}` (presence: `recording`, delay = duração estimada do áudio, mínimo 3s — usa metadata do upload ou um valor padrão).
2. Aguarda o delay do "recording" (curto, ~2-3s).
3. Envia o áudio via Evolution: `POST /message/sendWhatsAppAudio/{instance}` com `{ number, audio: <url> }` (endpoint correto para "áudio de PTT" que mostra recording).
4. Persiste no `whatsapp_conversations` como mensagem `from_me`, `type: "audio"`, com `media_url` e `content: transcript` (a transcrição vai no `content` para a IA ter contexto nas próximas rodadas).
5. Aplica idempotência via `withIdempotency` (chave `greeting-audio:{account_id}:{phone}:{slot}`).
6. Slot 2 aguarda `delay_after_ms` (10.000 ms) antes do passo 1.

Como há 2 slots, o agente emite 2 events `greeting_audio_dispatch` e o `dispatchAutomations` chama a automação para cada um sequencialmente (o `await` em loop já garante ordem; o delay de 10s do slot 2 acontece dentro da automação dele).

## 6. Trigger atual continua igual
A condição que hoje dispara o `stage === "greet"` (qualquer primeira mensagem que o `qualifier/stages.ts` classifica como "green") permanece — o usuário não pediu mudança no gatilho, só na resposta.

---

## Detalhes técnicos
- Tabela usa `GRANT SELECT TO authenticated`, `GRANT ALL TO service_role`. Função `has_role(auth.uid(),'super_admin')` controla escrita.
- Edge function lê via `service_role` (já é o padrão de `_igreen_v2`).
- Bucket público porque a Evolution API precisa baixar a URL para enviar no WhatsApp.
- Endpoint Evolution para áudio PTT (mostra "gravando áudio" nativamente no WhatsApp): `/message/sendWhatsAppAudio/{instance}` — diferente do `/sendMedia` usado para vídeo. Aceita URL pública direto.
- O `recording` presence é enviado **antes** do `sendWhatsAppAudio`; o WhatsApp do cliente mostra "gravando áudio…" enquanto a Evolution processa.
- A transcrição vira mensagem no `whatsapp_conversations.messages` com `type: "audio"` + `content: "<transcrição>"`. Isso é exatamente como o agente lê histórico hoje, então o contexto fica preservado para a IA continuar o atendimento normalmente (cliente responde com estado → segue fluxo de simulação existente).
- Fallback de segurança: se a tabela tiver `audio_url` vazio ou o upload falhar, o agente volta para as 5 bolhas de texto originais (nenhum cliente fica sem resposta).

---

## Entregáveis
1. Migration: tabela `igreen_default_greeting_audios` + grants + RLS + seed dos 2 slots vazios.
2. Bucket `igreen-audios` (público) + policy de upload restrita a super_admin.
3. Página admin nova: `src/pages/admin/AdminIgreenAudios.tsx` + rota em `App.tsx` + link no `AdminSidebar`.
4. Hook `src/hooks/useIgreenGreetingAudios.ts` (CRUD + upload).
5. Edge function `_igreen_v2/automations/greeting-audio-dispatch.ts` + registro em `_register-all.ts` + handler no `dispatch.ts` para o event `greeting_audio_dispatch`.
6. Edit em `_igreen_v2/agents/green/run.ts` (bloco `greet`): troca 5 bolhas por busca dos áudios + emissão dos 2 events + injeção das transcrições no patch de mensagens persistidas.

Depois do plano aprovado, você sobe os 2 arquivos de áudio pelo painel admin e cola as 2 transcrições nos campos correspondentes.