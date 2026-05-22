## Diagnóstico da conversa testada (Wemerson → 5547989118695)

Fluxo atual funcionou bem até a fatura, MAS:
- A fatura veio em nome de **Neide de Carvalho Bueno Marques** e o cliente se apresentou como **Wemerson**. A IA não percebeu e passou a chamar o cliente de "Neide".
- A CNH enviada era do **Wemerson Leite Oliveira** (nome diferente do titular da fatura). A IA também não comparou.
- Nenhuma tag foi adicionada e nenhum card de CRM foi movimentado nas etapas do funil ao longo do atendimento.
- Não houve notificação ao usuário (vendedor) quando o lead completou o envio dos documentos.

## O que vai ser implementado

### 1. Novas etapas no pipeline padrão (CRM do cliente)
Para todo account novo e como migração para os existentes:
- "Iniciou atendimento"
- "Enviou fatura"
- "Enviou documento"
- "Aguardando humano" (etapa final do fluxo automatizado)

A ordem ficará: IA → Iniciou atendimento → Enviou fatura → Enviou documento → Aguardando humano → (etapas de venda existentes).

### 2. Sistema de automações por tag
Nova tabela `crm_tag_automations` ligando uma tag a uma etapa de destino dentro de um pipeline. Quando uma tag é adicionada ao deal/contato, um trigger move o card para a etapa configurada (se ainda não estiver à frente dela).

Automações pré-criadas para todo account:
- tag `em atendimento` → etapa "Iniciou atendimento"
- tag `enviou fatura` → etapa "Enviou fatura"
- tag `enviou documento` → etapa "Enviou documento"

### 3. Novos campos estruturados por lead (Conexão Green)
Nova tabela `igreen_lead_data` (1 por contato + account) para a IA não se perder:
- estado
- distribuidora
- tipo_conta (residencial/comercial)
- nome_cliente (como o cliente se apresentou)
- nome_titular_fatura (extraído do PDF)
- cpf_titular_fatura (mascarado)
- valor_fatura
- nome_documento_identificacao (extraído do RG/CNH)
- cpf_documento (mascarado)
- fatura_url, documento_url
- titular_confirmado (bool — cliente confirmou que titular faz o cadastro)
- nomes_conferem (bool — nome do documento bate com titular da fatura)

A IA passa a ler/escrever esses campos via novas tools (`save_green_lead_field`, `get_green_lead_data`).

### 4. Novas tools no agente WhatsApp (`whatsapp-ai-agent` + simulador `test-ai-prompt`)
- `add_contact_tag(tag)` — adiciona tag no contato e dispara automação de etapa.
- `save_green_lead_field(field, value)` — preenche `igreen_lead_data`.
- `validate_green_invoice(extracted_name, extracted_cpf)` — chamada após receber fatura: salva os dados e compara com `nome_cliente`. Retorna `match: true|false`.
- `validate_green_identity(extracted_name)` — chamada após receber documento: compara com `nome_titular_fatura`. Retorna `match: true|false`.

### 5. Regras de comportamento da IA (atualização do `_igreen_flow.ts`)

ETAPA 3 (resposta ao vídeo):
- Ao receber a 1ª resposta do cliente após o vídeo, ANTES de qualquer outra coisa, chamar `add_contact_tag("em atendimento")`.

ETAPA QUALIFICAÇÃO:
- Conforme o cliente vai respondendo, chamar `save_green_lead_field` para estado/distribuidora/tipo_conta/valor.

ETAPA FATURA:
- Ao receber a fatura, chamar `validate_green_invoice(...)` com o nome do titular extraído.
- Se `match === true` → chamar `add_contact_tag("enviou fatura")` e seguir para pedido de documento.
- Se `match === false` → NÃO adicionar tag ainda. Responder educadamente:
  "{nome}, percebi que a conta está no nome de {titular}. Apenas o titular da fatura pode fazer o cadastro. Essa pessoa vai conseguir concluir o cadastro com a gente?"
  - Se cliente confirmar → seguir, salvar `titular_confirmado=true`, adicionar tag `enviou fatura`.
  - Se cliente negar → handoff humano com motivo "Titular da fatura indisponível".

ETAPA DOCUMENTO:
- Ao receber RG/CNH, chamar `validate_green_identity(...)`.
- Se nome do documento bater com o titular da fatura → `add_contact_tag("enviou documento")` E chamar `request_human_handoff` com motivo "Lead Conexão Green completou o fluxo, assumir atendimento".
- Se NÃO bater → responder: "Vi que o documento está em nome de {X} e a fatura está em nome de {Y}. Para concluir o cadastro preciso do documento do titular da fatura. Pode me enviar?"

### 6. Notificação ao usuário (vendedor) quando o lead completa o fluxo
Quando a tag `enviou documento` for adicionada, além de mover o card, dispara mensagem pela instância **system_whatsapp_instance** (mesmo canal das transferências para humano) para o WhatsApp do dono da account (e team members marcados em `notification_contacts.notify_handoffs`):

> "🚨 Lead pronto para fechamento — {nome} ({telefone}) completou o fluxo da Conexão Green e enviou fatura + documento. Assuma o atendimento."

Reaproveita o caminho de notificação de handoff já existente.

### 7. Varredura inicial
Migração roda uma única vez para:
- Criar as 4 novas etapas em todos os pipelines existentes (na posição correta, antes das etapas de venda).
- Criar as 3 automações de tag em todas as accounts.

---

## Arquivos / mudanças técnicas

**Migração SQL:**
- Cria tabelas `crm_tag_automations`, `igreen_lead_data` com RLS por account.
- Insere 4 etapas + 3 automações em todo pipeline/account existente.
- Trigger `trg_apply_tag_automation` em `contacts` (AFTER UPDATE of tags) e em `crm_deals` (AFTER UPDATE of tags) que move o deal ativo do contato para a etapa configurada.
- Ajuste no `seed` de pipelines para incluir as novas etapas em accounts futuras.

**Edge functions:**
- `supabase/functions/whatsapp-ai-agent/index.ts` — registra novas tools, handlers, e a chamada de notificação ao dono.
- `supabase/functions/test-ai-prompt/index.ts` — versão simulada das mesmas tools (sem efeitos colaterais).
- `supabase/functions/_igreen_flow.ts` — bloco de prompt atualizado com as regras de validação de titularidade e uso obrigatório das tools de tag/lead-data.

**Frontend:**
- Sem mudança de UI obrigatória; as tags/etapas novas já aparecem nos componentes existentes de CRM e contatos. (Opcional num próximo passo: tela de gerenciamento das automações de tag em Settings → CRM.)

---

## Posso seguir com essa implementação?
