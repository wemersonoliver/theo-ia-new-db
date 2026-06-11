# Correção dos follow-ups iGreen

## Diagnóstico confirmado
- A mensagem enviada hoje às **11:30** para `5544998619843` foi registrada como `sent_by: followup_ai`.
- Portanto, ela veio do **follow-up geral/legado**, e não de um cenário iGreen.
- A conta de Márcio está corretamente marcada como `is_igreen = true`, mas o follow-up geral está habilitado e criou uma sequência para esse contato.
- Existe outra mensagem desse follow-up geral prevista para **19:31**.
- Não existe inscrição ativa em `igreen_scenario_enrollments` para esse telefone.
- Também não há cenário iGreen habilitado/configurado para essa conta; o estado registra `scenario_disabled`.

## Implementação
1. **Bloquear contas iGreen no follow-up geral**
   - Adicionar uma verificação de `accounts.is_igreen` no detector de inatividade, gerador de sequência e disparador.
   - Usar defesa em profundidade: mesmo que uma sequência antiga já exista, o disparador não poderá enviá-la.

2. **Bloquear contas iGreen nos follow-ups personalizados comuns**
   - Aplicar a mesma proteção no gatilho, inscrição e disparador de custom follow-up.
   - Manter ativos apenas os mecanismos próprios do iGreen: cenários iGreen e automações iGreen relacionadas.

3. **Cancelar pendências já criadas**
   - Cancelar a sequência geral existente para `5544998619843`, incluindo o envio previsto para 19:31.
   - Cancelar outras sequências gerais ou personalizadas ainda pendentes em contas marcadas como iGreen, sem apagar o histórico do que já foi enviado.

4. **Melhorar rastreabilidade**
   - Registrar nos logs quando um envio for bloqueado por a conta ser iGreen.
   - Preservar `sent_by: igreen_scenario` para identificar claramente mensagens originadas pelos cenários.

5. **Validar e publicar as funções**
   - Testar que uma conta comum continua usando follow-up geral.
   - Testar que uma conta iGreen não entra nem dispara follow-up geral/customizado.
   - Confirmar que cenários iGreen continuam funcionando normalmente e publicar as funções alteradas.

## Resultado esperado
Contas iGreen usarão **somente os cenários iGreen**. O contato analisado não receberá a mensagem geral prevista para 19:31, e novas conversas iGreen não serão capturadas pelos sistemas de follow-up comuns.