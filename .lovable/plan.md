Plano para corrigir a causa do erro

O que encontrei
- O problema não é só “limpeza incompleta” do telefone.
- Quando você envia uma fatura em PDF/foto, o texto OCR entra no agente como `[Documento - análise]`.
- Antes de validar a fatura, o sistema tem uma regra automática de simulação que tenta achar qualquer número na última mensagem.
- Na sua fatura, o OCR trouxe o endereço `nº 160` antes de trazer o `TOTAL A PAGAR R$ 553,98`.
- Como a conversa já tinha uma pergunta anterior sobre “valor médio da fatura”, o sistema interpretou esse `160` do endereço como se fosse o valor da conta e respondeu pedindo a fatura de novo.
- Isso aparece mais quando o número já passou pelo fluxo porque ainda existe contexto recente no histórico: a IA já perguntou o valor, então qualquer número no OCR pode ativar a simulação indevidamente.

Correção proposta

1. Bloquear simulação automática em mensagens de mídia
- Se a última mensagem for `[Documento - análise]`, `[Imagem - análise]`, `[Documento]`, `[Imagem]` ou contiver `Conteúdo extraído`, o sistema não poderá rodar a simulação de economia.
- Nesses casos, ele deve tentar validar a fatura/documento, não calcular simulação.

2. Deixar a extração de valor mais segura
- A simulação só deve aceitar valor quando a mensagem do cliente for texto comum, como `500`, `R$ 500`, `minha conta é 500`.
- Não deve aceitar números soltos vindos de OCR, endereço, CEP, código de barras, leitura de kWh, unidade consumidora, CPF, datas etc.

3. Reordenar/fortalecer o fluxo de fatura
- Para mídia com OCR de energia, priorizar `parseGreenInvoiceFromOcr` e `validate_green_invoice`.
- Se o OCR vier incompleto, responder pedindo uma foto/PDF mais legível da fatura, em vez de cair na simulação.

4. Melhorar a exclusão/limpeza de conversa
- Hoje, excluir a conversa no WhatsApp apaga `whatsapp_conversations` e `whatsapp_ai_sessions`, mas deixa dados como `igreen_lead_data`, CRM, follow-ups e possíveis filas relacionadas.
- Vou ajustar a exclusão para também limpar os dados do fluxo iGreen e filas pendentes daquele telefone, evitando reaproveitamento de estado antigo em testes.

5. Validar com o mesmo caso real
- Usar o cenário do telefone `5547989118695` e confirmar que:
  - o OCR com `nº 160` não gera mais simulação de R$ 160;
  - a fatura é validada pelo titular/valor correto quando o OCR contém `TOTAL A PAGAR`;
  - ao excluir a conversa, os dados auxiliares do fluxo não ficam presos para o próximo teste.