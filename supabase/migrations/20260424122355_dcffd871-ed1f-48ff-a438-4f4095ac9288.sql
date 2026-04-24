-- Adiciona flag para forçar troca de senha no primeiro acesso de membros convidados
ALTER TABLE public.account_members
ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- Permite que o próprio membro leia e atualize esse flag (já lê via "Members can view team",
-- mas precisamos permitir UPDATE do próprio registro para limpar a flag após trocar a senha)
DROP POLICY IF EXISTS "Members can clear own password flag" ON public.account_members;
CREATE POLICY "Members can clear own password flag"
ON public.account_members
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());