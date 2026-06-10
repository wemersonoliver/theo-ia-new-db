## Problema

Toda transferência iGreen envia a mesma notificação:
> "O cliente concluiu o envio de fatura e documento — pode iniciar o cadastro."

Mas existem vários motivos diferentes de handoff (failsafe, palavra-chave, pedido explícito de humano, validação rejeitada, identidade aprovada, etc.) e o texto está fixo em `supabase/functions/_igreen_v2/automations/handoff.ts` (linha 111), independente do `reason`.

Resultado: o operador recebe sempre a mesma mensagem (incluindo `failsafe_triggered`, que NÃO é conclusão de cadastro), o que está confundindo a equipe iGreen.

## Solução

Tornar o título e a descrição da notificação dinâmicos com base no campo `reason` que já chega no `handoffAutomation`. Criar um mapa `reason → {title, descrição}` cobrindo todos os casos atuais e mantendo um fallback genérico.

### Mapeamento proposto

| reason recebido                              | Título                                            | Descrição                                                                 |
| -------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------- |
| `identity_validated_start_registration`      | ✅ Cliente pronto para cadastro                    | Fatura e documento validados — pode iniciar o cadastro na iGreen.         |
| `failsafe_triggered`                         | ⚠️ IA travou — atenção humana                     | A IA não conseguiu responder com segurança. Assuma a conversa.            |
| `explicit_user_request` / `keyword:humano…`  | 🙋 Cliente pediu atendente humano                 | O cliente solicitou falar com uma pessoa. Assuma a conversa.              |
| `holder_mismatch`                            | 🪪 Documento não bate com titular                 | O documento enviado não corresponde ao titular da fatura. Verifique.      |
| `not_identity_document`                      | 📄 Documento inválido enviado                     | O cliente enviou algo que não é documento de identidade. Verifique.       |
| `complaint` / contém "reclama"               | 😠 Reclamação detectada                           | Cliente demonstrou insatisfação. Atenda com prioridade.                   |
| fallback (qualquer outro)                    | 🔔 Atendimento iGreen precisa de você             | Motivo: `<reason>`. Assuma a conversa.                                    |

Regras de classificação:
- Se `reason` começa com `keyword:` → tratar como pedido explícito de humano.
- Se contém `failsafe` → categoria failsafe.
- Caso contrário, lookup direto no mapa; se não achar, fallback genérico (mantendo o `reason` cru visível no campo "Motivo").

### Alteração de código

Arquivo único: `supabase/functions/_igreen_v2/automations/handoff.ts`

1. Adicionar função `buildHandoffMessage(reason, displayName, phone, horario, summary)` que:
   - normaliza o `reason` (lowercase, trim, prefixos);
   - escolhe `{ title, body }` do mapa acima;
   - monta o template final reusando o mesmo layout (Nome / Telefone / Horário / Motivo / Resumo).
2. Substituir o template fixo (linha 111) por `const message = buildHandoffMessage(...)`.
3. Manter o campo `🔄 *Motivo:*` com o `reason` original — útil para diagnóstico.
4. Sem alterações em schema, RLS, tools, prompt, ou outras edge functions.

### Validação

- Deploy de `whatsapp-igreen-agent-v2` (compartilha o módulo).
- Conferir no banco os últimos handoffs do usuário `marcioevandrocosta@hotmail.com` para confirmar quais `reason` ele recebeu (failsafe nas 3 prints).
- Simular novamente uma conversa que termine em failsafe e outra que termine em `identity_validated_start_registration` para validar os dois textos distintos.

### Fora do escopo

- Não vou mexer em quando/como o failsafe dispara (já tratado em ajustes anteriores).
- Não vou mudar destinatários, idempotência, nem o fluxo de eventos — só o conteúdo da mensagem.
