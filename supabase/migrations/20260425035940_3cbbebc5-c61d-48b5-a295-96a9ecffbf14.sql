
-- ============== TABELAS ==============

CREATE TABLE public.help_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  icon text NOT NULL DEFAULT 'BookOpen',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.help_articles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id uuid NOT NULL REFERENCES public.help_categories(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  summary text,
  content text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, slug)
);

CREATE TABLE public.help_article_images (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id uuid NOT NULL REFERENCES public.help_articles(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  caption text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_help_articles_category ON public.help_articles(category_id);
CREATE INDEX idx_help_article_images_article ON public.help_article_images(article_id);

-- ============== TRIGGERS DE updated_at ==============

CREATE TRIGGER trg_help_categories_updated_at
  BEFORE UPDATE ON public.help_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_help_articles_updated_at
  BEFORE UPDATE ON public.help_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== RLS ==============

ALTER TABLE public.help_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_article_images ENABLE ROW LEVEL SECURITY;

-- help_categories
CREATE POLICY "Authenticated read help categories"
  ON public.help_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admins manage help categories"
  ON public.help_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- help_articles
CREATE POLICY "Authenticated read published help articles"
  ON public.help_articles FOR SELECT TO authenticated
  USING (published = true OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins manage help articles"
  ON public.help_articles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- help_article_images
CREATE POLICY "Authenticated read help article images"
  ON public.help_article_images FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admins manage help article images"
  ON public.help_article_images FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- ============== STORAGE BUCKET ==============

INSERT INTO storage.buckets (id, name, public)
VALUES ('help-center-images', 'help-center-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read help center images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'help-center-images');

CREATE POLICY "Super admins upload help center images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'help-center-images' AND public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins update help center images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'help-center-images' AND public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins delete help center images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'help-center-images' AND public.has_role(auth.uid(), 'super_admin'::app_role));

-- ============== SEED: CATEGORIAS ==============

INSERT INTO public.help_categories (slug, name, description, icon, position) VALUES
  ('primeiros-passos', 'Primeiros Passos', 'Comece por aqui — visão geral, login e configuração inicial.', 'Rocket', 1),
  ('whatsapp', 'WhatsApp', 'Como conectar e gerenciar sua instância do WhatsApp.', 'Smartphone', 2),
  ('agente-ia', 'Agente IA', 'Configure e personalize seu atendimento automático com IA.', 'Bot', 3),
  ('base-conhecimento', 'Base de Conhecimento', 'Como ensinar a IA com seus próprios documentos.', 'FileText', 4),
  ('crm', 'CRM', 'Gestão de oportunidades e funil de vendas.', 'Kanban', 5),
  ('agendamentos', 'Agendamentos', 'Configuração de horários e gestão de compromissos.', 'Calendar', 6),
  ('equipe', 'Equipe', 'Como cadastrar e gerenciar usuários da sua equipe.', 'Users', 7),
  ('assinaturas', 'Assinaturas', 'Planos, cobrança e período de teste.', 'CreditCard', 8);

-- ============== SEED: ARTIGOS ==============

DO $seed$
DECLARE
  cat_pp uuid;
  cat_wa uuid;
  cat_ia uuid;
  cat_bc uuid;
  cat_crm uuid;
  cat_ag uuid;
  cat_eq uuid;
  cat_as uuid;
BEGIN
  SELECT id INTO cat_pp  FROM public.help_categories WHERE slug = 'primeiros-passos';
  SELECT id INTO cat_wa  FROM public.help_categories WHERE slug = 'whatsapp';
  SELECT id INTO cat_ia  FROM public.help_categories WHERE slug = 'agente-ia';
  SELECT id INTO cat_bc  FROM public.help_categories WHERE slug = 'base-conhecimento';
  SELECT id INTO cat_crm FROM public.help_categories WHERE slug = 'crm';
  SELECT id INTO cat_ag  FROM public.help_categories WHERE slug = 'agendamentos';
  SELECT id INTO cat_eq  FROM public.help_categories WHERE slug = 'equipe';
  SELECT id INTO cat_as  FROM public.help_categories WHERE slug = 'assinaturas';

  -- PRIMEIROS PASSOS
  INSERT INTO public.help_articles (category_id, slug, title, summary, position, content) VALUES
  (cat_pp, 'o-que-e-theo-ia', 'O que é o Theo IA?', 'Entenda o que a plataforma faz e como ela vai ajudar seu negócio.', 1,
'<h2>O que é o Theo IA?</h2><p>O <strong>Theo IA</strong> é uma plataforma que conecta o seu WhatsApp a uma <strong>Inteligência Artificial</strong> capaz de atender seus clientes 24 horas por dia, 7 dias por semana, sem você precisar digitar nada.</p><p>Com o Theo IA você consegue:</p><ul><li>Responder clientes automaticamente no WhatsApp</li><li>Agendar atendimentos e reuniões pela IA</li><li>Organizar suas oportunidades em um CRM visual (Kanban)</li><li>Receber notificações quando algo importante acontecer</li><li>Treinar a IA com os documentos do seu negócio</li></ul><h3>Como funciona, em resumo</h3><ol><li>Você conecta o seu número de WhatsApp.</li><li>Você ensina a IA quem ela é (nome, função, tom de voz, regras).</li><li>O cliente manda mensagem normalmente.</li><li>A IA responde como se fosse um atendente humano.</li></ol><p>Pronto. Você passa a vender e atender enquanto faz outras coisas.</p>'),

  (cat_pp, 'fazendo-login', 'Como fazer login na plataforma', 'Passo a passo para acessar sua conta.', 2,
'<h2>Como fazer login</h2><p>Para entrar na sua conta:</p><h3>Passo 1 — Abra o site</h3><p>Acesse <strong>theoia.com.br</strong> no seu navegador (Chrome, Edge, Safari, Firefox — funciona em todos).</p><p><em>[PRINT 1: Tela inicial do site]</em></p><h3>Passo 2 — Clique em "Entrar"</h3><p>O botão fica no canto superior direito da tela.</p><p><em>[PRINT 2: Botão Entrar destacado]</em></p><h3>Passo 3 — Informe seu e-mail e senha</h3><p>Use o mesmo e-mail e senha que você cadastrou.</p><p><em>[PRINT 3: Tela de login preenchida]</em></p><h3>Passo 4 — Clique em "Entrar"</h3><p>Pronto! Você será levado para o <strong>Dashboard</strong>, onde verá o resumo da sua conta.</p><blockquote><strong>Esqueceu a senha?</strong> Clique em "Esqueci minha senha" na tela de login. Você receberá um e-mail com instruções para criar uma nova.</blockquote>'),

  (cat_pp, 'tour-dashboard', 'Conhecendo o Dashboard', 'O que cada parte da tela inicial significa.', 3,
'<h2>Conhecendo o Dashboard</h2><p>O Dashboard é a sua "tela de controle". Tudo o que está acontecendo no seu atendimento aparece resumido aqui.</p><h3>Menu lateral</h3><p>À esquerda você vê o menu com todas as áreas do sistema: Dashboard, WhatsApp, Agente IA, CRM, Conversas, Contatos, Agendamentos, Configurações e Suporte.</p><p><em>[PRINT 1: Menu lateral completo]</em></p><h3>Cards de métricas</h3><p>No topo aparecem os números mais importantes: total de atendimentos, conversões, agendamentos e tempo médio de atendimento.</p><p><em>[PRINT 2: Cards de métricas]</em></p><h3>Gráficos</h3><p>Mais abaixo você vê gráficos com a evolução do seu atendimento ao longo do tempo. Use os filtros do topo para mudar o período (hoje, semana, mês).</p><p><em>[PRINT 3: Gráficos do dashboard]</em></p>'),

  (cat_pp, 'completar-onboarding', 'Completando o onboarding inicial', 'Os 3 passos obrigatórios para começar a usar.', 4,
'<h2>Onboarding inicial</h2><p>Logo após criar a conta, o sistema vai te guiar por <strong>3 passos obrigatórios</strong>. Sem eles, a IA não consegue funcionar.</p><h3>Passo 1 — Conectar o WhatsApp</h3><p>Você vai escanear um QR Code com o celular para conectar seu número.</p><p><em>[PRINT 1: Tela de QR Code do onboarding]</em></p><h3>Passo 2 — Configurar o Agente IA</h3><p>Você vai dizer para a IA quem ela é, qual é o seu negócio e como ela deve falar com os clientes. Existe um <strong>assistente que faz perguntas</strong> e monta tudo para você — basta responder no chat.</p><p><em>[PRINT 2: Entrevista com a IA]</em></p><h3>Passo 3 — (Opcional) Adicionar base de conhecimento</h3><p>Você pode subir documentos (PDF, Word) com as informações da sua empresa para a IA ficar ainda mais inteligente.</p><blockquote>Depois desses passos, sua IA já está pronta para atender!</blockquote>');

  -- WHATSAPP
  INSERT INTO public.help_articles (category_id, slug, title, summary, position, content) VALUES
  (cat_wa, 'conectar-qrcode', 'Conectando o WhatsApp via QR Code', 'O jeito mais rápido de conectar seu número.', 1,
'<h2>Conectar via QR Code</h2><p>Esse é o método mais comum e rápido.</p><h3>Passo 1 — Acesse o menu WhatsApp</h3><p>No menu lateral, clique em <strong>"WhatsApp"</strong> (ícone de celular).</p><p><em>[PRINT 1: Menu lateral com WhatsApp destacado]</em></p><h3>Passo 2 — Clique em "Conectar"</h3><p>Você verá um botão grande chamado <strong>"Conectar WhatsApp"</strong>. Clique nele.</p><p><em>[PRINT 2: Botão Conectar WhatsApp]</em></p><h3>Passo 3 — Aguarde o QR Code aparecer</h3><p>Em poucos segundos um QR Code (quadrado preto e branco) vai aparecer na tela.</p><p><em>[PRINT 3: QR Code exibido na tela]</em></p><h3>Passo 4 — Escaneie com o celular</h3><p>No celular onde está seu WhatsApp:</p><ol><li>Abra o WhatsApp</li><li>Toque nos <strong>3 pontinhos</strong> (canto superior direito) → <strong>"Aparelhos conectados"</strong></li><li>Toque em <strong>"Conectar um aparelho"</strong></li><li>Aponte a câmera para o QR Code da tela</li></ol><p><em>[PRINT 4: Tela do WhatsApp em Aparelhos conectados]</em></p><h3>Passo 5 — Pronto!</h3><p>O status muda para <strong>"Conectado"</strong> em verde. Sua IA já pode receber e responder mensagens.</p><blockquote><strong>Importante:</strong> mantenha o celular com o WhatsApp ligado e conectado à internet.</blockquote>'),

  (cat_wa, 'conectar-pareamento', 'Conectando via código de pareamento (8 dígitos)', 'Alternativa para quando o QR Code não funciona.', 2,
'<h2>Código de pareamento</h2><p>Se o QR Code não estiver funcionando, use o código de 8 dígitos.</p><h3>Passo 1 — Vá em WhatsApp</h3><p>Menu lateral → <strong>"WhatsApp"</strong>.</p><h3>Passo 2 — Clique em "Usar código de pareamento"</h3><p>Logo abaixo do QR Code há essa opção.</p><p><em>[PRINT 1: Botão de pareamento]</em></p><h3>Passo 3 — Informe seu número</h3><p>Digite seu número de WhatsApp <strong>com DDD</strong> (ex: 47991293662).</p><p><em>[PRINT 2: Campo de número]</em></p><h3>Passo 4 — Anote o código de 8 dígitos</h3><p>O sistema vai gerar algo como <strong>ABCD-1234</strong>.</p><p><em>[PRINT 3: Código gerado]</em></p><h3>Passo 5 — Digite no celular</h3><p>No WhatsApp do celular: <strong>3 pontinhos → Aparelhos conectados → Conectar um aparelho → Conectar com número de telefone</strong>. Digite o código que apareceu na tela.</p><p><em>[PRINT 4: Tela do celular pedindo código]</em></p>'),

  (cat_wa, 'desconectar-whatsapp', 'Como desconectar o WhatsApp', 'Quando e como desligar a conexão.', 3,
'<h2>Desconectar o WhatsApp</h2><p>Você pode precisar desconectar quando:</p><ul><li>Quiser trocar o número usado pela IA</li><li>For trocar de celular</li><li>Quiser pausar o atendimento automático</li></ul><h3>Passo 1 — Acesse o menu WhatsApp</h3><p><em>[PRINT 1: Menu WhatsApp]</em></p><h3>Passo 2 — Clique em "Desconectar"</h3><p>O botão fica visível quando o status está como "Conectado".</p><p><em>[PRINT 2: Botão Desconectar]</em></p><h3>Passo 3 — Confirme</h3><p>O sistema vai pedir uma confirmação. Clique em <strong>"Sim, desconectar"</strong>.</p><blockquote>Depois de desconectar, a IA <strong>para de responder mensagens</strong> imediatamente.</blockquote>'),

  (cat_wa, 'whatsapp-caiu', 'WhatsApp desconectou sozinho — o que fazer?', 'Como religar quando a conexão cai.', 4,
'<h2>WhatsApp caiu — e agora?</h2><p>Acontece. O WhatsApp pode desconectar quando:</p><ul><li>Seu celular ficou sem internet por muito tempo</li><li>Você abriu o WhatsApp Web em outro navegador</li><li>O celular ficou desligado por mais de 14 dias</li></ul><h3>Como resolver</h3><p>Você verá um <strong>aviso vermelho no topo da tela</strong> avisando que a conexão caiu.</p><p><em>[PRINT 1: Banner de WhatsApp desconectado]</em></p><h3>Passo 1 — Vá em "WhatsApp"</h3><h3>Passo 2 — Clique em "Reconectar"</h3><p>O QR Code aparece de novo. Repita o processo de leitura no celular.</p><p><em>[PRINT 2: Tela de reconexão]</em></p>');

  -- AGENTE IA
  INSERT INTO public.help_articles (category_id, slug, title, summary, position, content) VALUES
  (cat_ia, 'configurar-agente', 'Configurando seu Agente IA pela primeira vez', 'Como dar personalidade e regras para sua IA.', 1,
'<h2>Configurando o Agente IA</h2><p>Esse é o passo mais importante. É aqui que você ensina a IA a ser <strong>seu vendedor virtual</strong>.</p><h3>Passo 1 — Acesse "Agente IA"</h3><p>Menu lateral → <strong>"Agente IA"</strong>.</p><p><em>[PRINT 1: Menu Agente IA]</em></p><h3>Passo 2 — Use o assistente de criação</h3><p>Recomendamos <strong>fortemente</strong> que você use o assistente. Ele vai te fazer perguntas como:</p><ul><li>Qual o nome do seu negócio?</li><li>O que você vende?</li><li>Como a IA deve se chamar?</li><li>Qual o tom de voz (formal, descontraído, etc.)?</li><li>Quando a IA deve passar para um humano?</li></ul><p><em>[PRINT 2: Tela do assistente]</em></p><h3>Passo 3 — Revise o prompt gerado</h3><p>Depois das perguntas, o sistema gera automaticamente o <strong>prompt</strong> (as instruções da IA). Você pode editar manualmente se quiser.</p><p><em>[PRINT 3: Prompt gerado]</em></p><h3>Passo 4 — Ative o agente</h3><p>Clique no botão <strong>"Ativar"</strong>. A partir daí, todas as mensagens recebidas são respondidas pela IA.</p><p><em>[PRINT 4: Botão Ativar]</em></p>'),

  (cat_ia, 'editar-prompt', 'Editando o prompt da IA', 'Como ajustar o comportamento da sua IA.', 2,
'<h2>Editando o prompt</h2><p>O <strong>prompt</strong> é o conjunto de instruções que define como a IA se comporta. Você pode editar a qualquer momento.</p><h3>Passo 1 — Vá em Agente IA</h3><h3>Passo 2 — Localize o campo "Prompt personalizado"</h3><p><em>[PRINT 1: Campo de prompt destacado]</em></p><h3>Passo 3 — Edite com cuidado</h3><p>Dicas:</p><ul><li><strong>Seja claro</strong>: escreva como se estivesse treinando um funcionário novo.</li><li><strong>Dê exemplos</strong>: "Se o cliente perguntar X, responda Y."</li><li><strong>Defina limites</strong>: "Nunca dê desconto sem confirmar comigo."</li><li><strong>Defina passagem para humano</strong>: "Se o cliente pedir para falar com uma pessoa, responda: vou te passar agora."</li></ul><h3>Passo 4 — Salve</h3><p>Clique em <strong>"Salvar"</strong>. As mudanças valem a partir da próxima mensagem recebida.</p><p><em>[PRINT 2: Botão Salvar]</em></p>'),

  (cat_ia, 'ativar-voz', 'Ativando respostas em áudio (voz)', 'Faça a IA enviar áudios em vez de só texto.', 3,
'<h2>Respostas em áudio</h2><p>A IA pode enviar mensagens de voz para deixar o atendimento mais humano.</p><h3>Passo 1 — Vá em Agente IA</h3><h3>Passo 2 — Vá na aba "Voz"</h3><p><em>[PRINT 1: Aba Voz]</em></p><h3>Passo 3 — Ative o switch "Voz habilitada"</h3><p>Importante: o uso de voz consome <strong>créditos</strong> separados. Verifique seu saldo na aba Assinaturas.</p><p><em>[PRINT 2: Switch de voz ativado]</em></p><h3>Passo 4 — Escolha a voz</h3><p>Selecione a voz preferida na lista (masculina, feminina, etc.) e ajuste estabilidade e velocidade se quiser.</p><p><em>[PRINT 3: Seleção de voz]</em></p><h3>Passo 5 — Salve</h3><blockquote>A IA vai responder em áudio sempre que o cliente também mandar áudio.</blockquote>'),

  (cat_ia, 'follow-up-automatico', 'Configurando follow-up automático', 'Faça a IA reengajar clientes que sumiram.', 4,
'<h2>Follow-up automático</h2><p>Cliente parou de responder? A IA pode mandar uma mensagem amigável depois de algumas horas para reengajar.</p><h3>Passo 1 — Acesse Agente IA → aba "Follow-up"</h3><p><em>[PRINT 1: Aba Follow-up]</em></p><h3>Passo 2 — Ative o follow-up</h3><h3>Passo 3 — Defina os parâmetros</h3><ul><li><strong>Inatividade</strong>: depois de quantas horas sem resposta a IA tenta novamente (padrão: 24h).</li><li><strong>Máximo de dias</strong>: por quantos dias seguir tentando (padrão: 6 dias).</li><li><strong>Janelas de envio</strong>: a IA só manda mensagens dentro desses horários (manhã e tarde).</li></ul><p><em>[PRINT 2: Configurações de follow-up]</em></p><h3>Passo 4 — Salve</h3>');

  -- BASE DE CONHECIMENTO
  INSERT INTO public.help_articles (category_id, slug, title, summary, position, content) VALUES
  (cat_bc, 'o-que-e-base-conhecimento', 'O que é a Base de Conhecimento?', 'Entenda como ela deixa sua IA mais inteligente.', 1,
'<h2>Base de Conhecimento</h2><p>É um espaço onde você sobe <strong>documentos do seu negócio</strong> (PDFs, textos, listas de preços) e a IA passa a usar essas informações para responder com mais precisão.</p><h3>Exemplos de documentos úteis</h3><ul><li>Tabela de preços</li><li>Catálogo de produtos/serviços</li><li>Perguntas frequentes (FAQ)</li><li>Políticas de troca, devolução, garantia</li><li>Endereços e horários de funcionamento</li></ul><blockquote>Quanto mais informação você der, mais precisa fica a IA.</blockquote>'),

  (cat_bc, 'subir-documento', 'Como subir um documento', 'Passo a passo para enviar arquivos.', 2,
'<h2>Subindo documentos</h2><h3>Passo 1 — Vá em "Base de Conhecimento"</h3><p>Menu lateral → ícone de documento.</p><p><em>[PRINT 1: Menu Base de Conhecimento]</em></p><h3>Passo 2 — Clique em "Adicionar documento"</h3><p><em>[PRINT 2: Botão Adicionar]</em></p><h3>Passo 3 — Selecione o arquivo</h3><p>Formatos aceitos: <strong>PDF, DOCX, TXT</strong>. Tamanho máximo recomendado: 10 MB.</p><p><em>[PRINT 3: Seleção de arquivo]</em></p><h3>Passo 4 — Aguarde o processamento</h3><p>O sistema lê o conteúdo e prepara para a IA usar. Pode levar de poucos segundos a 1 minuto.</p><p><em>[PRINT 4: Documento processado]</em></p><h3>Passo 5 — Pronto!</h3><p>A IA já passa a considerar esse conteúdo nas respostas.</p>'),

  (cat_bc, 'remover-documento', 'Removendo um documento', 'Como apagar arquivos que não são mais úteis.', 3,
'<h2>Removendo documento</h2><h3>Passo 1 — Acesse Base de Conhecimento</h3><h3>Passo 2 — Localize o documento na lista</h3><p><em>[PRINT 1: Lista de documentos]</em></p><h3>Passo 3 — Clique no ícone de lixeira</h3><p><em>[PRINT 2: Botão de exclusão]</em></p><h3>Passo 4 — Confirme</h3><blockquote>A IA para de usar esse documento imediatamente.</blockquote>');

  -- CRM
  INSERT INTO public.help_articles (category_id, slug, title, summary, position, content) VALUES
  (cat_crm, 'o-que-e-crm', 'O que é o CRM?', 'Entenda o funil de vendas visual.', 1,
'<h2>CRM Kanban</h2><p>O CRM é o <strong>quadro visual</strong> onde você acompanha todas as suas oportunidades de venda em colunas (etapas).</p><h3>Exemplo de etapas</h3><ol><li><strong>Novo lead</strong> — cliente que acabou de chegar</li><li><strong>Em conversa</strong> — está sendo atendido</li><li><strong>Proposta enviada</strong> — recebeu orçamento</li><li><strong>Fechado</strong> — virou venda 🎉</li></ol><p>Você arrasta os cards de uma coluna para outra conforme a negociação avança.</p><p><em>[PRINT 1: Tela do CRM com cards]</em></p>'),

  (cat_crm, 'criar-oportunidade', 'Criando uma nova oportunidade', 'Como adicionar um card no funil.', 2,
'<h2>Criando oportunidade</h2><h3>Passo 1 — Acesse o menu "CRM"</h3><h3>Passo 2 — Clique em "Nova oportunidade"</h3><p><em>[PRINT 1: Botão Nova oportunidade]</em></p><h3>Passo 3 — Preencha os dados</h3><ul><li><strong>Título</strong>: nome da oportunidade (ex: "Cliente João — pacote premium")</li><li><strong>Valor</strong>: quanto vale a venda</li><li><strong>Contato</strong>: vincule a um cliente já cadastrado</li><li><strong>Etapa</strong>: em qual coluna ela começa</li><li><strong>Prioridade</strong>: alta, média, baixa</li></ul><p><em>[PRINT 2: Formulário de oportunidade]</em></p><h3>Passo 4 — Salve</h3>'),

  (cat_crm, 'mover-etapa', 'Movendo cards entre etapas', 'Como avançar a venda no funil.', 3,
'<h2>Movendo cards</h2><p>Basta <strong>clicar e arrastar</strong> o card de uma coluna para outra.</p><p><em>[PRINT 1: Movimento de drag-and-drop]</em></p><h3>Atalho — pelo card</h3><p>Você também pode clicar no card → "Mudar etapa" → escolher a nova coluna.</p><p><em>[PRINT 2: Menu de ações do card]</em></p>'),

  (cat_crm, 'criar-funil', 'Criando um novo funil (pipeline)', 'Quando e como criar funis adicionais.', 4,
'<h2>Múltiplos funis</h2><p>Você pode ter mais de um funil. Por exemplo: um para vendas, outro para pós-venda.</p><h3>Passo 1 — Acesse CRM</h3><h3>Passo 2 — Clique no nome do funil atual (topo)</h3><p>Vai abrir um menu com a opção <strong>"Gerenciar funis"</strong>.</p><p><em>[PRINT 1: Seletor de funil]</em></p><h3>Passo 3 — Clique em "Novo funil"</h3><h3>Passo 4 — Dê um nome e crie as etapas</h3><p><em>[PRINT 2: Edição de funil]</em></p>');

  -- AGENDAMENTOS
  INSERT INTO public.help_articles (category_id, slug, title, summary, position, content) VALUES
  (cat_ag, 'configurar-horarios', 'Configurando seus horários disponíveis', 'Defina quando a IA pode marcar atendimentos.', 1,
'<h2>Horários disponíveis</h2><p>Antes da IA marcar agendamentos, você precisa dizer <strong>quando você atende</strong>.</p><h3>Passo 1 — Acesse "Config. Horários"</h3><p><em>[PRINT 1: Menu Config Horários]</em></p><h3>Passo 2 — Crie um tipo de atendimento</h3><p>Ex: "Consulta inicial", duração 30 minutos, segunda a sexta, das 09h às 18h.</p><p><em>[PRINT 2: Tipo de atendimento]</em></p><h3>Passo 3 — Salve</h3><blockquote>A IA já pode oferecer horários automaticamente quando o cliente pedir.</blockquote>'),

  (cat_ag, 'criar-agendamento-manual', 'Criando um agendamento manualmente', 'Quando você precisa marcar você mesmo.', 2,
'<h2>Agendamento manual</h2><h3>Passo 1 — Vá em "Agendamentos"</h3><h3>Passo 2 — Clique em "Novo agendamento"</h3><p><em>[PRINT 1: Botão Novo]</em></p><h3>Passo 3 — Preencha</h3><ul><li>Nome do cliente</li><li>Telefone</li><li>Data e hora</li><li>Observações (opcional)</li></ul><p><em>[PRINT 2: Formulário]</em></p><h3>Passo 4 — Salve</h3><p>O cliente recebe automaticamente uma mensagem de confirmação no WhatsApp.</p>'),

  (cat_ag, 'lembretes-automaticos', 'Lembretes automáticos', 'Como funciona a confirmação 2h antes.', 3,
'<h2>Lembretes automáticos</h2><p>O sistema envia automaticamente uma mensagem para o cliente <strong>2 horas antes</strong> do compromisso, perguntando se ele confirma a presença.</p><p>Não precisa configurar nada — funciona sozinho para todos os agendamentos.</p><p><em>[PRINT 1: Exemplo de mensagem de lembrete]</em></p><h3>O que acontece se ele responder "sim"?</h3><p>O agendamento é marcado como <strong>confirmado</strong>. Você vê isso na agenda.</p><h3>E se responder "não"?</h3><p>É marcado como <strong>cancelado</strong> e o horário fica livre novamente.</p>');

  -- EQUIPE
  INSERT INTO public.help_articles (category_id, slug, title, summary, position, content) VALUES
  (cat_eq, 'cadastrar-membro-equipe', 'Cadastrando um membro de equipe', 'Como dar acesso a outros usuários.', 1,
'<h2>Cadastrando equipe</h2><p>Você pode dar acesso ao sistema para vendedores, atendentes e gerentes.</p><h3>Passo 1 — Vá em "Configurações" → aba "Equipe"</h3><p><em>[PRINT 1: Aba Equipe]</em></p><h3>Passo 2 — Clique em "Adicionar membro"</h3><p><em>[PRINT 2: Botão Adicionar]</em></p><h3>Passo 3 — Preencha</h3><ul><li><strong>Nome completo</strong></li><li><strong>E-mail</strong> (será o login)</li><li><strong>Telefone</strong> (recebe a senha por WhatsApp)</li><li><strong>Função</strong>: gerente, vendedor ou atendente</li></ul><p><em>[PRINT 3: Formulário]</em></p><h3>Passo 4 — Salve</h3><p>O novo usuário recebe a <strong>senha automática</strong> via WhatsApp no padrão <strong>primeiro-nome@4-últimos-dígitos-do-telefone</strong> (ex: <code>thays@1328</code>).</p><blockquote>Ele será obrigado a trocar a senha no primeiro login.</blockquote>'),

  (cat_eq, 'permissoes-equipe', 'Entendendo as permissões', 'O que cada função pode fazer.', 2,
'<h2>Funções e permissões</h2><h3>Owner (você)</h3><p>Acesso total. Único que pode editar assinatura e gerenciar a equipe.</p><h3>Gerente</h3><p>Acesso a tudo, exceto cobrança e gestão de equipe.</p><h3>Vendedor</h3><p>Acesso a conversas, CRM, contatos, agendamentos e configurações pessoais.</p><h3>Atendente</h3><p>Acesso a conversas, contatos, agendamentos e configurações pessoais.</p><h3>Como editar permissões individualmente</h3><p>Configurações → Equipe → clique no membro → ative/desative cada permissão.</p><p><em>[PRINT 1: Tela de permissões individuais]</em></p>'),

  (cat_eq, 'remover-membro', 'Removendo um membro da equipe', 'Como tirar o acesso de alguém.', 3,
'<h2>Removendo membro</h2><h3>Passo 1 — Configurações → Equipe</h3><h3>Passo 2 — Localize o membro</h3><h3>Passo 3 — Clique no ícone de lixeira</h3><p><em>[PRINT 1: Botão remover]</em></p><h3>Passo 4 — Confirme</h3><blockquote>O acesso é cortado imediatamente.</blockquote>');

  -- ASSINATURAS
  INSERT INTO public.help_articles (category_id, slug, title, summary, position, content) VALUES
  (cat_as, 'periodo-teste', 'Período de teste gratuito', 'Como funcionam os 15 dias grátis.', 1,
'<h2>15 dias grátis</h2><p>Ao criar sua conta você ganha <strong>15 dias gratuitos</strong> com acesso completo a todas as funcionalidades.</p><p>O contador aparece no topo do dashboard.</p><p><em>[PRINT 1: Banner de trial]</em></p><h3>O que acontece quando acabar?</h3><p>Você precisa assinar um plano para continuar. Sua IA é desativada e o WhatsApp para de responder até a assinatura ser confirmada.</p><blockquote>Seus dados ficam guardados — basta assinar para reativar tudo.</blockquote>'),

  (cat_as, 'planos-disponiveis', 'Planos e preços', 'Diferença entre mensal e anual.', 2,
'<h2>Planos</h2><h3>Mensal — R$ 97/mês</h3><p>Cobrança recorrente todo mês. Cancele quando quiser.</p><h3>Anual — R$ 997/ano</h3><p>Equivale a <strong>R$ 83/mês</strong>. Você economiza R$ 167 no ano.</p><h3>Como assinar</h3><p>Vá em <strong>"Assinaturas"</strong> e clique no plano desejado. Você é levado para o pagamento seguro via Kiwify.</p><p><em>[PRINT 1: Tela de planos]</em></p>'),

  (cat_as, 'creditos-voz-ia', 'Créditos de voz da IA', 'Por que a voz é cobrada à parte.', 3,
'<h2>Créditos de voz</h2><p>O envio de mensagens em <strong>áudio</strong> pela IA usa um serviço externo cobrado por caractere. Por isso ele tem um saldo separado da assinatura.</p><h3>Onde ver o saldo</h3><p>Menu <strong>"Assinaturas"</strong> → seção "Créditos de voz".</p><p><em>[PRINT 1: Saldo de créditos]</em></p><h3>Como adicionar créditos</h3><p>Entre em contato com o suporte pelo WhatsApp <strong>+55 47 99129-3662</strong> para liberar mais créditos.</p>');
END
$seed$;
