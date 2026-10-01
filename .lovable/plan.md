# Ajustar atendimento Vida Card da Débora

## Objetivo
Atualizar o atendimento automático da conta `deboravcolombo@hotmail.com` para reconhecer corretamente associados do **Vida Card**, informar as condições específicas e usar a nova chave Pix.

## Alterações
1. **Separar o atendimento Vida Card do atendimento particular**
   - Quando o cliente mencionar Vida Card, cartão, associação ou associado, confirmar que se trata do atendimento pelo Vida Card.
   - Informar: abordagem TCC, atendimento para crianças, adolescentes e adultos, duração de 30 minutos e investimento de R$ 90,00.
   - Para consultas particulares, também informar o investimento de R$ 90,00 por sessão, preservando as demais regras atuais do atendimento particular.

2. **Atualizar o pagamento para todos os pacientes**
   - Remover completamente a chave Pix antiga por CPF.
   - Usar apenas: **CNPJ 66.163.686/0001-40**, Nubank, favorecida **Débora Colombo Psicóloga**.
   - Atualizar também a mensagem detalhada enviada após a confirmação do agendamento.

3. **Direcionar corretamente os agendamentos do Vida Card**
   - Instruir a IA a usar exatamente o serviço **“Sessão de Terapia”** para associados do Vida Card.
   - Manter a consulta obrigatória dos horários disponíveis antes de oferecer ou confirmar um horário.
   - Registrar no título/observação que o atendimento é pelo Vida Card, sem criar um serviço duplicado.

4. **Aplicar e validar**
   - Salvar o prompt completo atualizado diretamente na configuração da conta da Débora.
   - Conferir que o serviço “Sessão de Terapia” já configurado continua com duração de 30 minutos.
   - Simular perguntas sobre Vida Card, preço particular de R$ 90,00, pagamento e agendamento para confirmar que as respostas e o serviço escolhido estão corretos.

## Detalhes técnicos
- A conta e o prompt atual foram localizados.
- Já existem horários ativos de **Sessão de Terapia**, todos configurados com 30 minutos.
- A mudança será restrita à configuração da Débora; nenhuma outra conta será alterada.
