
## 1. Restauração do prompt — consultoriafontoura@gmail.com

Vou rodar um UPDATE em `whatsapp_ai_config` restaurando o valor exato do `custom_prompt` da versão de **25/06 16:08:54 BRT (4.908 chars)** que está em `whatsapp_ai_config_history`. Antes do UPDATE, o trigger `trg_snapshot_ai_config` salvará automaticamente a versão atual (1.375 chars) no histórico como backup.

## 2. Senha obrigatória para salvar alterações no prompt (todas as contas)

A senha exigida será a **mesma senha de login** do usuário Theo IA. Não criamos senha nova — a confirmação é feita reautenticando contra o Supabase Auth (`signInWithPassword` no e-mail da sessão atual). Se a senha estiver errada, o salvamento é bloqueado.

### Onde aplicar
Componente `src/components/ai/AIGeneralTab.tsx` (campo "Instruções Personalizadas" / botão "Salvar Configurações").

### Fluxo de UX
1. Usuário edita o prompt e clica em **Salvar Configurações**.
2. Se o campo `custom_prompt` mudou em relação ao valor original do banco, abre um `Dialog` (shadcn) pedindo a senha.
3. Usuário digita a senha → chamamos `supabase.auth.signInWithPassword({ email, password })`.
4. Em caso de sucesso: prossegue com o `saveConfig.mutate(...)` normalmente.
5. Em caso de falha: toast de erro "Senha incorreta" e o salvamento é abortado.
6. Se nenhum campo do prompt mudou (apenas outros campos como nome do agente, delay, etc.), salva direto sem pedir senha.

### Observações
- A reautenticação NÃO desloga o usuário (apenas valida credenciais).
- A senha nunca é armazenada, apenas usada na verificação imediata.
- O mesmo padrão valerá também para o botão de aplicar prompt da aba **Entrevista IA** (`InterviewTab`), para evitar bypass.

## 3. Correção da auditoria (registrar quem alterou)

O trigger atual `trg_snapshot_ai_config` já tenta gravar `changed_by = auth.uid()`, mas está vindo NULL porque o trigger roda como `SECURITY DEFINER`. Vou ajustar o fluxo para garantir o registro do autor:

- Adicionar coluna `changed_by_email text` em `whatsapp_ai_config_history` (mais robusto que UUID quando a sessão é definer).
- Reescrever o trigger para capturar `auth.uid()` corretamente (removendo `SECURITY DEFINER` ou usando `current_setting('request.jwt.claims', true)` para extrair sub/email).
- Adicionar coluna `change_method text` para diferenciar `password_confirmed` (UI normal) de `admin_override` (impersonação).
- Ao salvar pelo frontend, passar o e-mail confirmado via RPC `record_ai_prompt_change(...)` antes do UPDATE, garantindo rastro mesmo se o trigger falhar.

## 4. Ordem de execução

1. Migração SQL: ajusta trigger de auditoria + colunas extras em `whatsapp_ai_config_history`.
2. INSERT/UPDATE de dados: restaura o `custom_prompt` da `consultoriafontoura@gmail.com` para a versão de 4.908 chars.
3. Frontend: novo componente `PasswordConfirmDialog` reutilizável + integração em `AIGeneralTab.tsx` e `InterviewTab.tsx`.

## Detalhes técnicos (referência)

- **Tabela alvo**: `public.whatsapp_ai_config` (campo `custom_prompt`)
- **Tabela de histórico**: `public.whatsapp_ai_config_history`
- **Auth**: `supabase.auth.signInWithPassword` usando `user.email` da sessão atual
- **Componentes shadcn**: `Dialog`, `Input type="password"`, `Button`
- **Não altera**: lógica de IA, edge functions, ou demais configurações
