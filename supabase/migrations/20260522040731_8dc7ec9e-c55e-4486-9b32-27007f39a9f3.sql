
-- 1) Default do follow-up pós-vídeo: 120 → 50 segundos
ALTER TABLE public.igreen_account_products
  ALTER COLUMN followup_after_video_seconds SET DEFAULT 50;

UPDATE public.igreen_account_products
   SET followup_after_video_seconds = 50
 WHERE followup_after_video_seconds IS NULL
    OR followup_after_video_seconds = 120;

-- 2) Tabela global de descontos por distribuidora/estado
CREATE TABLE IF NOT EXISTS public.igreen_distributor_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text NOT NULL,
  state_name text NOT NULL,
  distributor text NOT NULL,
  distributor_aliases text[] NOT NULL DEFAULT '{}'::text[],
  discount_residencial_percent numeric(5,2),
  discount_comercial_percent numeric(5,2),
  min_bill_brl numeric(10,2) DEFAULT 200,
  notes text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS igreen_distributor_discounts_state_distributor_key
  ON public.igreen_distributor_discounts (lower(state), lower(distributor));

CREATE INDEX IF NOT EXISTS igreen_distributor_discounts_state_idx
  ON public.igreen_distributor_discounts (lower(state));

DROP TRIGGER IF EXISTS trg_igreen_distributor_discounts_updated_at ON public.igreen_distributor_discounts;
CREATE TRIGGER trg_igreen_distributor_discounts_updated_at
BEFORE UPDATE ON public.igreen_distributor_discounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.igreen_distributor_discounts ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário autenticado (tabela global de referência)
DROP POLICY IF EXISTS "Authenticated can read distributor discounts" ON public.igreen_distributor_discounts;
CREATE POLICY "Authenticated can read distributor discounts"
ON public.igreen_distributor_discounts
FOR SELECT
TO authenticated
USING (true);

-- Escrita: somente super_admin
DROP POLICY IF EXISTS "Super admin manages distributor discounts" ON public.igreen_distributor_discounts;
CREATE POLICY "Super admin manages distributor discounts"
ON public.igreen_distributor_discounts
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- 3) Seed inicial das principais distribuidoras cobertas pela iGreen
INSERT INTO public.igreen_distributor_discounts
  (state, state_name, distributor, distributor_aliases, discount_residencial_percent, discount_comercial_percent, min_bill_brl, notes)
VALUES
  ('SC','Santa Catarina','Celesc',          ARRAY['celesc','celesc sc'],                     15, 18, 200, 'Cobertura ampla em SC.'),
  ('MG','Minas Gerais','Cemig',             ARRAY['cemig','cemig mg'],                       15, 18, 200, 'Cobertura ampla em MG.'),
  ('PR','Paraná','Copel',                   ARRAY['copel','copel pr'],                       14, 16, 200, 'Cobertura ampla no PR.'),
  ('SP','São Paulo','Enel SP',              ARRAY['enel sp','enel são paulo','enel sao paulo','eletropaulo'], 15, 18, 200, 'Capital e Grande SP.'),
  ('RJ','Rio de Janeiro','Enel RJ',         ARRAY['enel rj','enel rio'],                     13, 15, 200, 'Antiga Ampla.'),
  ('CE','Ceará','Enel CE',                  ARRAY['enel ce','enel ceara','coelce'],          15, 18, 200, 'Cobertura ampla no CE.'),
  ('GO','Goiás','Enel GO',                  ARRAY['enel go','enel goias','celg'],            13, 15, 200, 'Cobertura GO/DF rural.'),
  ('SP','São Paulo','CPFL Paulista',        ARRAY['cpfl','cpfl paulista','cpfl sp'],         15, 18, 200, 'Interior de SP.'),
  ('SP','São Paulo','CPFL Piratininga',     ARRAY['cpfl piratininga','piratininga'],         15, 18, 200, 'Baixada Santista e ABC.'),
  ('RS','Rio Grande do Sul','RGE',          ARRAY['rge','rge sul','cpfl rge'],               13, 15, 200, 'Cobertura RS.'),
  ('SP','São Paulo','EDP SP',               ARRAY['edp sp','edp bandeirante','bandeirante'], 13, 15, 200, 'Alto Tietê / Vale do Paraíba.'),
  ('ES','Espírito Santo','EDP ES',          ARRAY['edp es','edp espirito santo','escelsa'],  13, 15, 200, 'Cobertura ES.'),
  ('RJ','Rio de Janeiro','Light',           ARRAY['light','light rj'],                       13, 15, 200, 'Capital RJ.'),
  ('PA','Pará','Equatorial PA',             ARRAY['equatorial','equatorial pa','equatorial para','equatorial pará','celpa'], 15, 18, 200, 'Cobertura PA.'),
  ('MA','Maranhão','Equatorial MA',         ARRAY['equatorial ma','equatorial maranhao','cemar'], 15, 18, 200, 'Cobertura MA.'),
  ('PI','Piauí','Equatorial PI',            ARRAY['equatorial pi','equatorial piaui','cepisa'],  15, 18, 200, 'Cobertura PI.'),
  ('AL','Alagoas','Equatorial AL',          ARRAY['equatorial al','equatorial alagoas','ceal'],  13, 15, 200, 'Cobertura AL.'),
  ('GO','Goiás','Equatorial GO',            ARRAY['equatorial go','equatorial goias'],      13, 15, 200, 'Cobertura GO.'),
  ('MT','Mato Grosso','Energisa MT',        ARRAY['energisa mt','energisa mato grosso'],    13, 15, 200, 'Cobertura MT.'),
  ('MS','Mato Grosso do Sul','Energisa MS', ARRAY['energisa ms','energisa mato grosso do sul'], 13, 15, 200, 'Cobertura MS.'),
  ('TO','Tocantins','Energisa TO',          ARRAY['energisa to','energisa tocantins'],      13, 15, 200, 'Cobertura TO.'),
  ('SE','Sergipe','Energisa SE',            ARRAY['energisa se','energisa sergipe','energipe'], 13, 15, 200, 'Cobertura SE.'),
  ('PB','Paraíba','Energisa PB',            ARRAY['energisa pb','energisa paraiba'],        13, 15, 200, 'Cobertura PB.'),
  ('MG','Minas Gerais','Energisa MG',       ARRAY['energisa mg','energisa minas','energisa minas gerais'], 13, 15, 200, 'Sul de MG.'),
  ('BA','Bahia','Coelba',                   ARRAY['coelba','neoenergia coelba'],             15, 18, 200, 'Cobertura BA.'),
  ('RN','Rio Grande do Norte','Cosern',     ARRAY['cosern','neoenergia cosern'],             13, 15, 200, 'Cobertura RN.'),
  ('PE','Pernambuco','Celpe',               ARRAY['celpe','neoenergia celpe'],               13, 15, 200, 'Cobertura PE.'),
  ('DF','Distrito Federal','Neoenergia DF', ARRAY['neoenergia df','neoenergia brasilia','ceb'], 13, 15, 200, 'DF.'),
  ('SP','São Paulo','Elektro',              ARRAY['elektro','neoenergia elektro'],           13, 15, 200, 'Interior SP / MS.')
ON CONFLICT (lower(state), lower(distributor)) DO NOTHING;
