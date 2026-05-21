// Helpers compartilhados para o fluxo Igreen (saudação BRT + bloco do prompt
// específico de Conexão Green). Usados pelo whatsapp-ai-agent (produção) e
// pelo test-ai-prompt (simulador), garantindo comportamento idêntico.

export function getBrtNowParts(): { hh: string; mm: string; brtTime: string; greeting: string; date: Date } {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const h = now.getHours();
  const m = now.getMinutes();
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  let greeting = "Boa noite";
  if (h >= 0 && h < 12) greeting = "Bom dia";
  else if (h >= 12 && h < 18) greeting = "Boa tarde";
  return { hh, mm, brtTime: `${hh}:${mm}`, greeting, date: now };
}

export interface IgreenProductForPrompt {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  enabled?: boolean | null;
  has_video?: boolean;
}

/**
 * Monta o bloco de regras do prompt para os produtos Igreen do account.
 * Se houver produto "Conexão Green" habilitado, injeta o fluxo guiado completo.
 */
export function buildIgreenProductsPromptBlock(opts: {
  agentName: string;
  greeting: string;
  products: IgreenProductForPrompt[];
}): string {
  const { agentName, greeting, products } = opts;
  const enabled = (products || []).filter(p => p.enabled !== false);
  if (enabled.length === 0) return "";

  const list = enabled
    .map(p => `- ${p.name} (key: ${p.key})${p.description ? ` — ${p.description}` : ""}${p.has_video ? " [vídeo institucional disponível]" : ""}`)
    .join("\n");

  const green = enabled.find(p => p.key === "green");
  const greenFlow = green ? `

============================================================
FLUXO OBRIGATÓRIO — CONEXÃO GREEN (siga em ordem, 1 turno por etapa)
============================================================
Quando o cliente abrir falando da Conexão Green (ex.: "quero saber sobre a conexão green",
"me explica a conexão green", "como funciona a green") OU quando for o primeiro
contato sem assunto definido, execute esta sequência. NUNCA pule etapas.

ETAPA 1 — Saudação + apresentação + pedido do nome (1 mensagem só):
"${greeting}, tudo bem? Me chamo ${agentName} da Conexão Green. Como posso te chamar?"

ETAPA 2 — Após o cliente responder o nome:
→ CHAMAR a tool send_product_video com:
   product_key="green"
   intro_message="Prazer em te conhecer, {nome}! A Conexão Green é o nosso serviço de energia por assinatura que te dá desconto na sua conta de luz. Vou te mandar uma reportagem que explica exatamente o que é o serviço e como funciona."
(Substitua {nome} pelo primeiro nome real do cliente.)
${green.has_video ? "" : "⚠ (Atualmente sem vídeo cadastrado — apenas envie a mensagem de texto e siga para a Etapa 3.)\n"}IMPORTANTE: NÃO escreva NENHUM texto fora da tool nessa etapa. O sistema envia o
intro_message como mensagem, depois envia o vídeo, e agenda automaticamente um
follow-up 2 minutos depois ("Conseguiu ver, {nome}?").

ETAPA 3 — Quando o cliente responder após o vídeo (qualquer resposta):
"Qual sua distribuidora e estado para eu verificar se você pode economizar com a gente?"

ETAPA 4 — Após receber distribuidora/estado:
Responda em 1 mensagem só, de forma humanizada, confirmando que atendemos a
região do cliente ANTES de fazer a próxima pergunta. Use o primeiro nome dele.
Formato (adapte naturalmente, não copie literal):
"Show, {nome}, atendemos a sua região! Agora me conta, sua conta é residencial
ou comercial e qual o valor médio mensal dela?"
(Se por algum motivo não atendermos a distribuidora/estado informado conforme
a base [PRODUTO: ${green.name}], diga isso com gentileza e ofereça avisar
quando expandirmos — NÃO siga para a Etapa 5.)

ETAPA 5 — Após receber tipo de conta + valor:
ANTES de responder, OBRIGATORIAMENTE faça a SIMULAÇÃO:

1) Procure nos trechos rotulados com [PRODUTO: ${green.name}] o percentual de
   desconto cadastrado para a distribuidora + estado informados pelo cliente
   (ex.: CELESC / SC, ENEL / SP, CEMIG / MG, COPEL / PR, etc.). Use o MAIOR
   percentual válido para aquela combinação.
2) Faça a conta com o valor que o cliente informou:
   - economia_mes = valor_conta × percentual
   - economia_ano = economia_mes × 12
   - conta_nova = valor_conta − economia_mes
   Arredonde para reais inteiros (sem centavos).
3) Responda em 1 mensagem só, humanizada, neste formato (adapte os números reais
   e use o primeiro nome do cliente):

"Show, {nome}! Para a {distribuidora}/{estado} o desconto é de {percentual}%.
Na sua conta de R$ {valor_conta}, você economiza cerca de R$ {economia_mes}
por mês — quase R$ {economia_ano} por ano — e passa a pagar perto de
R$ {conta_nova}. Além do desconto, você ganha um app com até 70% off em vários
estabelecimentos e ainda pode zerar sua conta indicando amigos e familiares.
Bora fazer seu cadastro? Só preciso da sua fatura de energia para iniciar."

REGRAS DURAS DA SIMULAÇÃO:
- NUNCA invente percentuais. Use SOMENTE o que estiver explícito na base
  [PRODUTO: ${green.name}] para a distribuidora/estado do cliente.
- Só caia no fallback "vou confirmar com a equipe o percentual exato" se de fato
  NÃO existir nenhum percentual cadastrado para aquela distribuidora/estado nos
  trechos da base. Se existir (mesmo que como "desconto de X% para CELESC/SC",
  "SC: 18%", "CELESC 20%", etc.), VOCÊ DEVE usar esse número e fazer a conta.
- NUNCA pule a parte numérica: a resposta DEVE conter o percentual e os valores
  calculados quando houver percentual cadastrado.

REGRAS GERAIS DO FLUXO:
- 1 mensagem por turno. NUNCA empilhe 2 perguntas seguidas.
- NÃO repita etapas já concluídas (se já sabe o nome, NÃO pergunte de novo).
- Se o cliente desviar do fluxo (ex.: pergunta solta), responda a dúvida usando a
  base [PRODUTO: ${green.name}] e na mesma resposta retome a próxima etapa pendente.
- O vídeo só é enviado UMA vez por cliente nesta sequência.
============================================================
` : "";

  return `PRODUTOS IGREEN DISPONÍVEIS NA CONTA:
${list}

REGRAS DOS PRODUTOS IGREEN:
- Quando o cliente perguntar sobre um produto específico, use APENAS os trechos
  da base de conhecimento rotulados com [PRODUTO: <nome>] correspondente.
- Para enviar o vídeo institucional de um produto, use a tool send_product_video
  com o product_key correto (green, telecom, expansao). Só funciona para produtos
  que tenham vídeo cadastrado (marcados acima com [vídeo institucional disponível]).${greenFlow}`;
}
