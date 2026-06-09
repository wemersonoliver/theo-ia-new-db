## Objetivo

Copiar integralmente o **Cenário 1** configurado pelo usuário `projetoswemerson.tw@gmail.com` para o usuário `thays.chavess@gmail.com`, para que a conta da Thays sirva como padrão (template) de todos os usuários do plano iGreen.

## Mapeamento

- Origem: `Etapa 1` (id `37f85677…`) — conta de Wemerson
- Destino: `Cenário 1` (id `9ba67e21…`) — conta de Thays (hoje vazio: 0 dias / 0 mensagens / 0 itens)

Conteúdo a copiar da origem: **7 dias**, **14 mensagens** (manhã/tarde), **23 itens** (textos e vídeos).

## O que será copiado

1. **Configuração do cenário** (na linha `9ba67e21…` da Thays):
   - `description`, `enabled`, `product_key`
   - `final_tag` = `"NAO PASSOU CENARIO 1"`
   - `final_tag_delay_hours` = `24`
   - `trigger_tag`: vou manter o da Thays (`CENARIO1`) — a do Wemerson está como `ETEPA1` (provável digitação)
   - `name`: mantém `"Cenário 1"` (não copio `"Etapa 1"`)

2. **Dias** (`igreen_scenario_days`): 7 dias copiados com `day_number` e `enabled`.

3. **Mensagens** (`igreen_scenario_messages`): 14 mensagens copiadas com `period` e `label`.

4. **Itens** (`igreen_scenario_items`): 23 itens copiados com `position`, `type`, `content`, `caption`, `media_url`, `media_mime`, `media_filename`, `delay_value`, `delay_unit`.

## Observação sobre as mídias

Os vídeos estão como URLs assinadas do bucket `followup-media` apontando para a pasta da conta do Wemerson (`1aae0245…/…`). Vou copiar a URL como está — ela continua acessível por leitura. Se você quiser que os arquivos sejam **republicados na pasta da Thays** (para ficarem 100% independentes da conta do Wemerson), me avise que faço isso em um segundo passo (download + reupload + atualização das URLs).

## Execução (SQL em uma única transação)

```text
BEGIN;
  UPDATE igreen_scenarios (campos de config) WHERE id = destino;

  -- Para cada dia da origem: INSERT em days (destino) retornando novo id
  -- Para cada mensagem do dia: INSERT em messages com novo day_id
  -- Para cada item da mensagem: INSERT em items com novo message_id
COMMIT;
```

Usarei CTEs com `RETURNING` para preservar o mapeamento origem→destino de IDs sem precisar de loops.

## Validação pós-execução

Vou rodar `SELECT count(*)` em days/messages/items do cenário destino e confirmar 7 / 14 / 23.
