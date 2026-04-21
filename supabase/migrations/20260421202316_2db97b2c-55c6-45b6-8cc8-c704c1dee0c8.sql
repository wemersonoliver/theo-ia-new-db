
-- =====================================================
-- ETAPA 1: TABELAS ACCOUNTS E ACCOUNT_MEMBERS
-- =====================================================

-- Enum para papéis dentro de uma account
CREATE TYPE public.account_role AS ENUM ('owner', 'manager', 'seller', 'agent');

-- Enum para status de membro
CREATE TYPE public.account_member_status AS ENUM ('active', 'invited', 'suspended', 'removed');

-- Tabela de contas (empresas)
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Minha Empresa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_accounts_owner ON public.accounts(owner_user_id);

-- Tabela de membros das contas
CREATE TABLE public.account_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.account_role NOT NULL DEFAULT 'agent',
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.account_member_status NOT NULL DEFAULT 'active',
  invited_at timestamptz NOT NULL DEFAULT now(),
  invited_by uuid,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, user_id)
);

CREATE INDEX idx_account_members_user ON public.account_members(user_id) WHERE status != 'removed';
CREATE INDEX idx_account_members_account ON public.account_members(account_id) WHERE status != 'removed';

-- Trigger updated_at
CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_account_members_updated_at
  BEFORE UPDATE ON public.account_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- FUNÇÕES AUXILIARES (SECURITY DEFINER para evitar recursão)
-- =====================================================

-- Retorna o account_id do usuário logado (sua própria conta se owner, ou conta onde é membro)
CREATE OR REPLACE FUNCTION public.current_account_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_id
  FROM public.account_members
  WHERE user_id = auth.uid()
    AND status = 'active'
  ORDER BY (role = 'owner') DESC, invited_at ASC
  LIMIT 1;
$$;

-- Checa se usuário é membro ativo da conta
CREATE OR REPLACE FUNCTION public.is_account_member(_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_members
    WHERE account_id = _account_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$;

-- Retorna o papel do usuário em uma account
CREATE OR REPLACE FUNCTION public.get_account_role(_account_id uuid)
RETURNS public.account_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.account_members
  WHERE account_id = _account_id
    AND user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;
$$;

-- Checa permissão combinando papel base + override
CREATE OR REPLACE FUNCTION public.has_account_permission(_account_id uuid, _permission text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m_role public.account_role;
  m_perms jsonb;
  override_value jsonb;
BEGIN
  SELECT role, permissions INTO m_role, m_perms
  FROM public.account_members
  WHERE account_id = _account_id
    AND user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;

  IF m_role IS NULL THEN
    RETURN false;
  END IF;

  -- Override explícito tem prioridade
  override_value := m_perms -> _permission;
  IF override_value IS NOT NULL THEN
    RETURN (override_value)::boolean;
  END IF;

  -- Defaults por papel
  IF m_role = 'owner' THEN
    RETURN true;
  ELSIF m_role = 'manager' THEN
    RETURN _permission NOT IN ('billing', 'team_management');
  ELSIF m_role = 'seller' THEN
    RETURN _permission IN ('conversations', 'crm', 'contacts', 'appointments', 'settings', 'support');
  ELSIF m_role = 'agent' THEN
    RETURN _permission IN ('conversations', 'appointments', 'contacts', 'settings', 'support');
  END IF;

  RETURN false;
END;
$$;

-- Helper: deve aplicar filtro por assigned_to? (true se NÃO tem view_all_assigned)
CREATE OR REPLACE FUNCTION public.must_filter_by_assignment(_account_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m_role public.account_role;
  m_perms jsonb;
  override_value jsonb;
BEGIN
  SELECT role, permissions INTO m_role, m_perms
  FROM public.account_members
  WHERE account_id = _account_id
    AND user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;

  IF m_role IS NULL THEN RETURN true; END IF;

  override_value := m_perms -> 'view_all_assigned';
  IF override_value IS NOT NULL THEN
    RETURN NOT (override_value)::boolean;
  END IF;

  -- Defaults: owner/manager veem tudo
  RETURN m_role IN ('seller', 'agent');
END;
$$;

-- =====================================================
-- RLS DAS NOVAS TABELAS
-- =====================================================

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;

-- accounts: dono e membros podem ver; só dono atualiza
CREATE POLICY "Account members can view account"
  ON public.accounts FOR SELECT
  USING (public.is_account_member(id) OR owner_user_id = auth.uid());

CREATE POLICY "Owner can update account"
  ON public.accounts FOR UPDATE
  USING (owner_user_id = auth.uid());

CREATE POLICY "Owner can insert account"
  ON public.accounts FOR INSERT
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Super admins manage all accounts"
  ON public.accounts FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- account_members: usuário vê os membros da própria conta
CREATE POLICY "Members can view team"
  ON public.account_members FOR SELECT
  USING (public.is_account_member(account_id) OR user_id = auth.uid());

CREATE POLICY "Owner manages members"
  ON public.account_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE id = account_members.account_id
        AND owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE id = account_members.account_id
        AND owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins manage all members"
  ON public.account_members FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- =====================================================
-- BACKFILL: criar account para cada usuário existente
-- =====================================================

DO $$
DECLARE
  p RECORD;
  new_account_id uuid;
BEGIN
  FOR p IN SELECT user_id, full_name FROM public.profiles LOOP
    -- Verifica se já existe account para esse usuário
    IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE owner_user_id = p.user_id) THEN
      INSERT INTO public.accounts (owner_user_id, name)
      VALUES (p.user_id, COALESCE(p.full_name, 'Minha Empresa'))
      RETURNING id INTO new_account_id;

      -- Insere o owner como membro
      INSERT INTO public.account_members (account_id, user_id, role, status)
      VALUES (new_account_id, p.user_id, 'owner', 'active')
      ON CONFLICT (account_id, user_id) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- =====================================================
-- TRIGGER: criar account automaticamente para novos usuários
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_account_id uuid;
BEGIN
  -- Cria account para o novo usuário
  INSERT INTO public.accounts (owner_user_id, name)
  VALUES (NEW.user_id, COALESCE(NEW.full_name, 'Minha Empresa'))
  ON CONFLICT (owner_user_id) DO NOTHING
  RETURNING id INTO new_account_id;

  -- Se o conflito impediu retorno, busca o existente
  IF new_account_id IS NULL THEN
    SELECT id INTO new_account_id FROM public.accounts WHERE owner_user_id = NEW.user_id LIMIT 1;
  END IF;

  -- Adiciona o owner como membro
  IF new_account_id IS NOT NULL THEN
    INSERT INTO public.account_members (account_id, user_id, role, status)
    VALUES (new_account_id, NEW.user_id, 'owner', 'active')
    ON CONFLICT (account_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_account ON public.profiles;
CREATE TRIGGER trg_profile_account
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_account();

-- =====================================================
-- ADICIONAR COLUNAS account_id E assigned_to
-- =====================================================

-- Tabelas com account_id
ALTER TABLE public.whatsapp_conversations ADD COLUMN IF NOT EXISTS account_id uuid;
ALTER TABLE public.whatsapp_conversations ADD COLUMN IF NOT EXISTS assigned_to uuid;
ALTER TABLE public.whatsapp_ai_config ADD COLUMN IF NOT EXISTS account_id uuid;
ALTER TABLE public.whatsapp_instances ADD COLUMN IF NOT EXISTS account_id uuid;
ALTER TABLE public.whatsapp_ai_sessions ADD COLUMN IF NOT EXISTS account_id uuid;
ALTER TABLE public.whatsapp_pending_responses ADD COLUMN IF NOT EXISTS account_id uuid;

ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS account_id uuid;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS assigned_to uuid;

ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS account_id uuid;
ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS assigned_to uuid;
ALTER TABLE public.crm_pipelines ADD COLUMN IF NOT EXISTS account_id uuid;
ALTER TABLE public.crm_stages ADD COLUMN IF NOT EXISTS account_id uuid;
ALTER TABLE public.crm_activities ADD COLUMN IF NOT EXISTS account_id uuid;
ALTER TABLE public.crm_deal_products ADD COLUMN IF NOT EXISTS account_id uuid;

ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS account_id uuid;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS assigned_to uuid;
ALTER TABLE public.appointment_types ADD COLUMN IF NOT EXISTS account_id uuid;
ALTER TABLE public.appointment_slots ADD COLUMN IF NOT EXISTS account_id uuid;

ALTER TABLE public.knowledge_base_documents ADD COLUMN IF NOT EXISTS account_id uuid;
ALTER TABLE public.notification_contacts ADD COLUMN IF NOT EXISTS account_id uuid;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS account_id uuid;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS account_id uuid;
ALTER TABLE public.followup_config ADD COLUMN IF NOT EXISTS account_id uuid;
ALTER TABLE public.followup_tracking ADD COLUMN IF NOT EXISTS account_id uuid;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS account_id uuid;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS account_id uuid;

-- =====================================================
-- BACKFILL: preencher account_id em todas as tabelas
-- =====================================================

UPDATE public.whatsapp_conversations c SET account_id = a.id FROM public.accounts a WHERE a.owner_user_id = c.user_id AND c.account_id IS NULL;
UPDATE public.whatsapp_ai_config c SET account_id = a.id FROM public.accounts a WHERE a.owner_user_id = c.user_id AND c.account_id IS NULL;
UPDATE public.whatsapp_instances c SET account_id = a.id FROM public.accounts a WHERE a.owner_user_id = c.user_id AND c.account_id IS NULL;
UPDATE public.whatsapp_ai_sessions c SET account_id = a.id FROM public.accounts a WHERE a.owner_user_id = c.user_id AND c.account_id IS NULL;
UPDATE public.whatsapp_pending_responses c SET account_id = a.id FROM public.accounts a WHERE a.owner_user_id = c.user_id AND c.account_id IS NULL;
UPDATE public.contacts c SET account_id = a.id FROM public.accounts a WHERE a.owner_user_id = c.user_id AND c.account_id IS NULL;
UPDATE public.crm_deals c SET account_id = a.id FROM public.accounts a WHERE a.owner_user_id = c.user_id AND c.account_id IS NULL;
UPDATE public.crm_pipelines c SET account_id = a.id FROM public.accounts a WHERE a.owner_user_id = c.user_id AND c.account_id IS NULL;
UPDATE public.crm_stages c SET account_id = a.id FROM public.accounts a WHERE a.owner_user_id = c.user_id AND c.account_id IS NULL;
UPDATE public.crm_activities c SET account_id = a.id FROM public.accounts a WHERE a.owner_user_id = c.user_id AND c.account_id IS NULL;
UPDATE public.crm_deal_products c SET account_id = a.id FROM public.accounts a WHERE a.owner_user_id = c.user_id AND c.account_id IS NULL;
UPDATE public.appointments c SET account_id = a.id FROM public.accounts a WHERE a.owner_user_id = c.user_id AND c.account_id IS NULL;
UPDATE public.appointment_types c SET account_id = a.id FROM public.accounts a WHERE a.owner_user_id = c.user_id AND c.account_id IS NULL;
UPDATE public.appointment_slots c SET account_id = a.id FROM public.accounts a WHERE a.owner_user_id = c.user_id AND c.account_id IS NULL;
UPDATE public.knowledge_base_documents c SET account_id = a.id FROM public.accounts a WHERE a.owner_user_id = c.user_id AND c.account_id IS NULL;
UPDATE public.notification_contacts c SET account_id = a.id FROM public.accounts a WHERE a.owner_user_id = c.user_id AND c.account_id IS NULL;
UPDATE public.products c SET account_id = a.id FROM public.accounts a WHERE a.owner_user_id = c.user_id AND c.account_id IS NULL;
UPDATE public.support_tickets c SET account_id = a.id FROM public.accounts a WHERE a.owner_user_id = c.user_id AND c.account_id IS NULL;
UPDATE public.followup_config c SET account_id = a.id FROM public.accounts a WHERE a.owner_user_id = c.user_id AND c.account_id IS NULL;
UPDATE public.followup_tracking c SET account_id = a.id FROM public.accounts a WHERE a.owner_user_id = c.user_id AND c.account_id IS NULL;
UPDATE public.subscriptions c SET account_id = a.id FROM public.accounts a WHERE a.owner_user_id = c.user_id AND c.account_id IS NULL;
UPDATE public.platform_settings c SET account_id = a.id FROM public.accounts a WHERE a.owner_user_id = c.user_id AND c.account_id IS NULL;

-- Backfill assigned_to: por padrão atribui ao owner (user_id atual)
UPDATE public.whatsapp_conversations SET assigned_to = user_id WHERE assigned_to IS NULL;
UPDATE public.contacts SET assigned_to = user_id WHERE assigned_to IS NULL;
UPDATE public.crm_deals SET assigned_to = user_id WHERE assigned_to IS NULL;
UPDATE public.appointments SET assigned_to = user_id WHERE assigned_to IS NULL;

-- =====================================================
-- ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_account ON public.whatsapp_conversations(account_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_assigned ON public.whatsapp_conversations(assigned_to);
CREATE INDEX IF NOT EXISTS idx_contacts_account ON public.contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_contacts_assigned ON public.contacts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_deals_account ON public.crm_deals(account_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_assigned ON public.crm_deals(assigned_to);
CREATE INDEX IF NOT EXISTS idx_appointments_account ON public.appointments(account_id);
CREATE INDEX IF NOT EXISTS idx_appointments_assigned ON public.appointments(assigned_to);

-- =====================================================
-- POLÍTICAS RLS ADICIONAIS PARA MEMBROS DA EQUIPE
-- (mantém as existentes baseadas em user_id para compatibilidade)
-- =====================================================

-- WHATSAPP_CONVERSATIONS
CREATE POLICY "Team members view assigned conversations"
  ON public.whatsapp_conversations FOR SELECT
  USING (
    public.is_account_member(account_id)
    AND public.has_account_permission(account_id, 'conversations')
    AND (
      NOT public.must_filter_by_assignment(account_id)
      OR assigned_to = auth.uid()
      OR assigned_to IS NULL
    )
  );

CREATE POLICY "Team members update assigned conversations"
  ON public.whatsapp_conversations FOR UPDATE
  USING (
    public.is_account_member(account_id)
    AND public.has_account_permission(account_id, 'conversations')
    AND (
      NOT public.must_filter_by_assignment(account_id)
      OR assigned_to = auth.uid()
      OR assigned_to IS NULL
    )
  );

CREATE POLICY "Team members insert conversations"
  ON public.whatsapp_conversations FOR INSERT
  WITH CHECK (
    public.is_account_member(account_id)
    AND public.has_account_permission(account_id, 'conversations')
  );

-- CONTACTS
CREATE POLICY "Team members view contacts"
  ON public.contacts FOR SELECT
  USING (
    public.is_account_member(account_id)
    AND public.has_account_permission(account_id, 'contacts')
    AND (
      NOT public.must_filter_by_assignment(account_id)
      OR assigned_to = auth.uid()
      OR assigned_to IS NULL
    )
  );

CREATE POLICY "Team members manage contacts"
  ON public.contacts FOR ALL
  USING (
    public.is_account_member(account_id)
    AND public.has_account_permission(account_id, 'contacts')
    AND (
      NOT public.must_filter_by_assignment(account_id)
      OR assigned_to = auth.uid()
      OR assigned_to IS NULL
    )
  )
  WITH CHECK (
    public.is_account_member(account_id)
    AND public.has_account_permission(account_id, 'contacts')
  );

-- CRM_DEALS
CREATE POLICY "Team members view deals"
  ON public.crm_deals FOR SELECT
  USING (
    public.is_account_member(account_id)
    AND public.has_account_permission(account_id, 'crm')
    AND (
      NOT public.must_filter_by_assignment(account_id)
      OR assigned_to = auth.uid()
      OR assigned_to IS NULL
    )
  );

CREATE POLICY "Team members manage deals"
  ON public.crm_deals FOR ALL
  USING (
    public.is_account_member(account_id)
    AND public.has_account_permission(account_id, 'crm')
    AND (
      NOT public.must_filter_by_assignment(account_id)
      OR assigned_to = auth.uid()
      OR assigned_to IS NULL
    )
  )
  WITH CHECK (
    public.is_account_member(account_id)
    AND public.has_account_permission(account_id, 'crm')
  );

-- CRM_PIPELINES, CRM_STAGES, CRM_ACTIVITIES, CRM_DEAL_PRODUCTS
CREATE POLICY "Team members manage pipelines"
  ON public.crm_pipelines FOR ALL
  USING (public.is_account_member(account_id) AND public.has_account_permission(account_id, 'crm'))
  WITH CHECK (public.is_account_member(account_id) AND public.has_account_permission(account_id, 'crm'));

CREATE POLICY "Team members manage stages"
  ON public.crm_stages FOR ALL
  USING (public.is_account_member(account_id) AND public.has_account_permission(account_id, 'crm'))
  WITH CHECK (public.is_account_member(account_id) AND public.has_account_permission(account_id, 'crm'));

CREATE POLICY "Team members manage activities"
  ON public.crm_activities FOR ALL
  USING (public.is_account_member(account_id) AND public.has_account_permission(account_id, 'crm'))
  WITH CHECK (public.is_account_member(account_id) AND public.has_account_permission(account_id, 'crm'));

CREATE POLICY "Team members manage deal products"
  ON public.crm_deal_products FOR ALL
  USING (public.is_account_member(account_id) AND public.has_account_permission(account_id, 'crm'))
  WITH CHECK (public.is_account_member(account_id) AND public.has_account_permission(account_id, 'crm'));

-- APPOINTMENTS
CREATE POLICY "Team members view appointments"
  ON public.appointments FOR SELECT
  USING (
    public.is_account_member(account_id)
    AND public.has_account_permission(account_id, 'appointments')
    AND (
      NOT public.must_filter_by_assignment(account_id)
      OR assigned_to = auth.uid()
      OR assigned_to IS NULL
    )
  );

CREATE POLICY "Team members manage appointments"
  ON public.appointments FOR ALL
  USING (
    public.is_account_member(account_id)
    AND public.has_account_permission(account_id, 'appointments')
    AND (
      NOT public.must_filter_by_assignment(account_id)
      OR assigned_to = auth.uid()
      OR assigned_to IS NULL
    )
  )
  WITH CHECK (
    public.is_account_member(account_id)
    AND public.has_account_permission(account_id, 'appointments')
  );

CREATE POLICY "Team members manage appointment types"
  ON public.appointment_types FOR ALL
  USING (public.is_account_member(account_id) AND public.has_account_permission(account_id, 'appointment_settings'))
  WITH CHECK (public.is_account_member(account_id) AND public.has_account_permission(account_id, 'appointment_settings'));

CREATE POLICY "Team members manage appointment slots"
  ON public.appointment_slots FOR ALL
  USING (public.is_account_member(account_id) AND public.has_account_permission(account_id, 'appointment_settings'))
  WITH CHECK (public.is_account_member(account_id) AND public.has_account_permission(account_id, 'appointment_settings'));

-- KNOWLEDGE_BASE_DOCUMENTS
CREATE POLICY "Team members manage knowledge"
  ON public.knowledge_base_documents FOR ALL
  USING (public.is_account_member(account_id) AND public.has_account_permission(account_id, 'knowledge_base'))
  WITH CHECK (public.is_account_member(account_id) AND public.has_account_permission(account_id, 'knowledge_base'));

-- NOTIFICATION_CONTACTS
CREATE POLICY "Team members manage notification contacts"
  ON public.notification_contacts FOR ALL
  USING (public.is_account_member(account_id) AND public.has_account_permission(account_id, 'settings'))
  WITH CHECK (public.is_account_member(account_id) AND public.has_account_permission(account_id, 'settings'));

-- PRODUCTS
CREATE POLICY "Team members manage products"
  ON public.products FOR ALL
  USING (public.is_account_member(account_id) AND public.has_account_permission(account_id, 'crm'))
  WITH CHECK (public.is_account_member(account_id) AND public.has_account_permission(account_id, 'crm'));

-- SUPPORT_TICKETS
CREATE POLICY "Team members view support tickets"
  ON public.support_tickets FOR SELECT
  USING (public.is_account_member(account_id) AND public.has_account_permission(account_id, 'support'));

CREATE POLICY "Team members create support tickets"
  ON public.support_tickets FOR INSERT
  WITH CHECK (public.is_account_member(account_id) AND public.has_account_permission(account_id, 'support'));

-- WHATSAPP_AI_CONFIG
CREATE POLICY "Team members manage ai config"
  ON public.whatsapp_ai_config FOR ALL
  USING (public.is_account_member(account_id) AND public.has_account_permission(account_id, 'ai_config'))
  WITH CHECK (public.is_account_member(account_id) AND public.has_account_permission(account_id, 'ai_config'));

-- WHATSAPP_INSTANCES
CREATE POLICY "Team members manage whatsapp instance"
  ON public.whatsapp_instances FOR ALL
  USING (public.is_account_member(account_id) AND public.has_account_permission(account_id, 'whatsapp_instance'))
  WITH CHECK (public.is_account_member(account_id) AND public.has_account_permission(account_id, 'whatsapp_instance'));

-- FOLLOWUP_CONFIG
CREATE POLICY "Team members manage followup config"
  ON public.followup_config FOR ALL
  USING (public.is_account_member(account_id) AND public.has_account_permission(account_id, 'ai_config'))
  WITH CHECK (public.is_account_member(account_id) AND public.has_account_permission(account_id, 'ai_config'));

-- SUBSCRIPTIONS
CREATE POLICY "Team members view subscriptions"
  ON public.subscriptions FOR SELECT
  USING (public.is_account_member(account_id));

-- PLATFORM_SETTINGS
CREATE POLICY "Team members manage platform settings"
  ON public.platform_settings FOR ALL
  USING (public.is_account_member(account_id) AND public.has_account_permission(account_id, 'settings'))
  WITH CHECK (public.is_account_member(account_id) AND public.has_account_permission(account_id, 'settings'));
