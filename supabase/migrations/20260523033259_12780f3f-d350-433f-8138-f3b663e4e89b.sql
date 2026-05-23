
-- Reconstrução da tabela de descontos Igreen:
-- agora trabalha com faixa min/max por consumo, sem diferenciar residencial/comercial.

ALTER TABLE public.igreen_distributor_discounts
  DROP COLUMN IF EXISTS discount_residencial_percent,
  DROP COLUMN IF EXISTS discount_comercial_percent;

ALTER TABLE public.igreen_distributor_discounts
  ADD COLUMN IF NOT EXISTS discount_min_percent numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS discount_max_percent numeric NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS modalidade text,
  ADD COLUMN IF NOT EXISTS credit_analysis text,
  ADD COLUMN IF NOT EXISTS injection_days text;

-- Limpa dados antigos (foram inseridos com percentuais errados)
TRUNCATE TABLE public.igreen_distributor_discounts;

-- Reinsere a planilha corrigida (agregada por UF+distribuidora — pega o range mais amplo)
INSERT INTO public.igreen_distributor_discounts
  (state, state_name, distributor, distributor_aliases, discount_min_percent, discount_max_percent, min_bill_brl, modalidade, credit_analysis, injection_days, enabled)
VALUES
  ('AL','Alagoas','Equatorial',                ARRAY['Equatorial AL','Equatorial Alagoas','Ceal'],            10,14, 200,'Com troca de titularidade','Não realizada','90 dias',true),
  ('BA','Bahia','Coelba Neoenergia',           ARRAY['Coelba','Neoenergia','Neoenergia Coelba'],              10,14, 200,'Com/Sem troca de titularidade','Não realizada','90 dias',true),
  ('CE','Ceará','Enel',                        ARRAY['Enel CE','Enel Ceará','Coelce'],                        10,20, 200,'Com/Sem troca de titularidade','Não realizada','90 dias',true),
  ('ES','Espírito Santo','EDP',                ARRAY['EDP ES','EDP Espírito Santo','Escelsa'],                10,10, 200,'Sem troca / não permitida','Não realizada','120 dias',true),
  ('GO','Goiás','Equatorial',                  ARRAY['Equatorial GO','Equatorial Goiás','Enel GO','Celg'],    10,20, 200,'Com/Sem troca de titularidade','Sim (Realizada)','90 dias',true),
  ('MA','Maranhão','Equatorial',               ARRAY['Equatorial MA','Equatorial Maranhão','Cemar'],          10,14, 200,'Consumo entre 100 e 500 kWh','Não realizada','120 dias',true),
  ('MG','Minas Gerais','CEMIG',                ARRAY['Cemig','Cemig D'],                                      10,24, 200,'Sem troca / não permitida','Não realizada','90 dias',true),
  ('MG','Minas Gerais','CPFL Santa Cruz',      ARRAY['CPFL','Santa Cruz'],                                    10,14, 200,'Sem troca / não permitida','Sim (Realizada)','90 dias',true),
  ('MG','Minas Gerais','Energisa Minas Rio',   ARRAY['EMR','Energisa MG','Energia Minas Rio'],                10,18, 200,'Com troca de titularidade','Não realizada','90 dias',true),
  ('MG','Minas Gerais','Energisa Sul Sudeste', ARRAY['Energisa Sul','Gedisa'],                                10,14, 200,'Consumo acima de 350 kWh (Gedisa)','Não realizada','90 dias',true),
  ('MS','Mato Grosso do Sul','Elektro',        ARRAY['Elektro MS','Elektro Neoenergia MS'],                   10,14, 200,'Com/Sem troca de titularidade','Sim (Realizada)','90 dias',true),
  ('MS','Mato Grosso do Sul','Energisa',       ARRAY['Energisa MS','Energisa Mato Grosso do Sul'],            10,14, 200,'Com troca de titularidade','Não realizada','90 dias',true),
  ('MT','Mato Grosso','Energisa',              ARRAY['Energisa MT','Energisa Mato Grosso'],                   10,20, 200,'Com/Sem troca de titularidade','Não realizada','90 dias',true),
  ('PA','Pará','Equatorial',                   ARRAY['Equatorial PA','Equatorial Pará','Celpa'],              10,14, 200,'Sem troca / não permitida','Não informado','90 dias',true),
  ('PB','Paraíba','Energisa',                  ARRAY['Energisa PB','Energisa Paraíba'],                       10,14, 200,'Sem troca / não permitida','Não realizada','90 dias',true),
  ('PE','Pernambuco','Neoenergia Celpe',       ARRAY['Celpe','Neoenergia PE'],                                10,14, 200,'Com troca de titularidade','Não realizada','90 dias',true),
  ('PI','Piauí','Equatorial',                  ARRAY['Equatorial PI','Equatorial Piauí','Cepisa'],            10,14, 200,'Com troca de titularidade','Não realizada','90 dias',true),
  ('PR','Paraná','CPFL Santa Cruz',            ARRAY['CPFL','Santa Cruz'],                                    10,14, 200,'Sem troca / não permitida','Sim (Realizada)','90 dias',true),
  ('PR','Paraná','Copel',                      ARRAY['Copel PR','Copel Paraná','Copel Distribuição'],         10,14, 200,'Com/Sem troca de titularidade','Não realizada','90 dias',true),
  ('RJ','Rio de Janeiro','Enel',               ARRAY['Enel RJ','Enel Rio','Ampla'],                           10,14, 200,'Com troca de titularidade','Sim (Realizada)','90 dias',true),
  ('RJ','Rio de Janeiro','Energisa Minas Rio', ARRAY['EMR','Energisa Nova Friburgo'],                         10,18, 200,'Com troca de titularidade','Não realizada','90 dias',true),
  ('RN','Rio Grande do Norte','Cosern Equatorial', ARRAY['Cosern','Equatorial RN','Neoenergia Cosern'],       10,14, 200,'Com/Sem troca de titularidade','Não realizada','90 dias',true),
  ('RS','Rio Grande do Sul','CEEE Equatorial', ARRAY['CEEE','Equatorial RS','CEEE-D'],                        10,14, 200,'Sem troca / não permitida','Não realizada','90 dias',true),
  ('RS','Rio Grande do Sul','RGE',             ARRAY['RGE Sul','CPFL RGE'],                                   10,14, 200,'Com troca de titularidade (Boleto Unificado)','Não realizada','90 dias',true),
  ('SC','Santa Catarina','Celesc',             ARRAY['Celesc SC','Celesc Distribuição'],                      10,14, 200,'Com troca de titularidade','Não realizada','90 dias',true),
  ('SE','Sergipe','Energisa',                  ARRAY['Energisa SE','Energisa Sergipe','Energipe'],            10,14, 200,'Com troca de titularidade','Não informado','90 dias',true),
  ('SP','São Paulo','CPFL Paulista',           ARRAY['CPFL','CPFL SP'],                                       10,14, 200,'Com troca de titularidade','Não realizada','90 dias',true),
  ('SP','São Paulo','CPFL Piratininga',        ARRAY['CPFL','Piratininga'],                                   10,14, 200,'Com troca de titularidade','Sim (Realizada)','120 dias',true),
  ('SP','São Paulo','CPFL Santa Cruz',         ARRAY['CPFL','Santa Cruz'],                                    10,14, 200,'Sem troca / não permitida','Sim (Realizada)','90 dias',true),
  ('SP','São Paulo','Elektro Neoenergia',      ARRAY['Elektro','Elektro SP','Neoenergia Elektro'],            10,14, 200,'Com troca de titularidade','Não realizada','90 dias',true),
  ('SP','São Paulo','Energisa Sul Sudeste',    ARRAY['Energisa Sul','Gedisa'],                                10,14, 200,'Consumo acima de 350 kWh (Gedisa)','Não realizada','90 dias',true),
  ('TO','Tocantins','Energisa',                ARRAY['Energisa TO','Energisa Tocantins','Celtins'],           10,14, 200,'Sem troca / não permitida','Não realizada','90 dias',true);
