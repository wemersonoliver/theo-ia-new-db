## Plano de melhorias — Academia Mexicomigo (consultoriafontoura@gmail.com)

Cliente identificado:
- user_id: `744e33a8-3b85-4593-948e-bcaf81f8397b`
- account_id: `9f9b5baf-17ab-45ae-b78b-7f12fa745567`

### 1. Reescrever o prompt da Isa (não copiar literalmente o enviado)

O prompt do cliente é longo, repetitivo e prescritivo demais — o que faz a IA "recitar" e perder naturalidade. Vou consolidar em um prompt **enxuto, persuasivo e com linguagem de academia**, mantendo TODAS as regras críticas e informações comerciais, mas reescritas para:

- **Tom**: enérgico, direto, "treineiro", com gírias leves do mundo fitness ("bora", "treino forte", "shape", "consistência"), sem exagero de emoji.
- **Tamanho**: mensagens curtas (1–3 frases). Nada de blocos longos. Cadência de conversa, não de catálogo.
- **Persuasão (armas do Cialdini aplicadas com sutileza)**:
  - *Autoridade*: citar Carlos Fontoura (43 anos, recordista, campeão) só quando faz sentido — nunca como abertura.
  - *Prova social*: "milhares de alunos de todas as idades transformaram o shape aqui".
  - *Escassez/urgência leve*: "essa condição do Clube+ tá rodando agora", "anual sai por menos da metade do mensal — vale travar".
  - *Reciprocidade*: oferecer a semana experimental de R$22 abatível, mostrar que está "ajudando", não vendendo.
  - *Compromisso e coerência*: pequenos "sins" antes do fechamento ("seu objetivo é ganhar massa, certo? então o ideal é treinar 4–5x"). 
  - *Ancoragem*: sempre apresentar mensal R$169 antes do Clube+ R$79 médio (ancoragem de preço).
- **Estrutura interna do prompt** (seções claras para a IA, não para o cliente):
  1. Identidade (Isa, consultora da Mexicomigo).
  2. Tom e estilo (curto, persuasivo, linguagem de academia, 1 emoji por mensagem no máx).
  3. Regras invioláveis (não cumprimentar 2x, não repetir info, ler histórico, conduzir ao fechamento com sutileza, etc.).
  4. Objetivo: visita / aula experimental paga / fechamento de plano.
  5. Catálogo enxuto (planos, preços, condições, descontos) — entregue só quando perguntado.
  6. Diferenciais e autoridade (usar de forma cirúrgica).
  7. Estrutura/horários/exceções (13h, 22h, 11h sáb/feriado, chuveiros, estacionamento, kids, instrutores).
  8. Oferta de contenção (FontouraConcept online — só quando o lead hesitar).
  9. Cliente ativo: detectar, não oferecer planos, responder com tom motivacional curto.

O prompt final terá ~1500–2000 caracteres (vs. 4480 atuais), mais fácil para o Gemini executar com fidelidade.

### 2. Horários de atendimento da IA

Manter 24/7 (`00:00–23:59`, todos os dias) no `whatsapp_ai_config`.

Motivo: a regra do cliente diz "responder normalmente em qualquer horário; só não enviar **espontâneo** fora do comercial". Quem controla envios espontâneos é o follow-up, não o horário da IA.

### 3. Janelas de follow-up

Já estão corretas: 08:00–12:00 e 13:00–19:00. Sem alteração.

### 4. Bloquear follow-ups aos domingos (mudança global de código)

Hoje `_followup-window.ts` não exclui domingo. Vou:
- Em `isWithinWindow`: retornar `false` quando o dia da semana BRT for 0 (domingo).
- Em `generateScheduleSequence`: ao avançar o cursor para um novo dia, se cair em domingo, pular para segunda.

Afeta todos os usuários do follow-up — é uma boa prática geral para WhatsApp e evita bloqueios por spam.

### 5. Follow-up rotativo para clientes ativos

**Adiado**, conforme sua orientação. Será tratado em uma próxima entrega.

---

### Resumo das mudanças desta entrega

| Item | Onde | Tipo |
|---|---|---|
| Novo prompt enxuto e persuasivo da Isa | `whatsapp_ai_config.custom_prompt` (account `9f9b5baf...`) | UPDATE de dado |
| Horários da IA | sem alteração | — |
| Janelas de follow-up | sem alteração | — |
| Excluir domingos do follow-up (global) | `supabase/functions/_followup-window.ts` | edição de código |

### Validação após implementar

- Conferir o prompt salvo no painel do cliente (Configurações → IA → Geral).
- Testar 3–4 conversas no "Simular Atendimento": dúvida sobre planos, "vou pensar", cliente ativo, pergunta sobre horário/aparelhos. Verificar tom, tamanho de mensagem e se conduz ao fechamento sem repetir.
- Simular um disparo de follow-up em horário válido e em domingo para confirmar bloqueio.
