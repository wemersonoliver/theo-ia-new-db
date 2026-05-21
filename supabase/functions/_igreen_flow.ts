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

type GreenSimulationMessage = {
  role?: string;
  from_me?: boolean;
  content?: string | null;
  ai_content?: string | null;
};

const BRAZIL_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const DISTRIBUTOR_ALIASES = [
  "CELESC", "CEMIG", "COPEL", "ENEL", "CPFL", "EDP", "ENERGISA", "EQUATORIAL",
  "ELEKTRO", "LIGHT", "RGE", "CEEE", "NEOENERGIA", "COELBA", "COSERN", "CELPE",
  "AMPLA", "ESCELSA", "BANDEIRANTE", "PIRATININGA", "SANTA CRUZ",
];

function normalizeFlowText(text: string | null | undefined): string {
  return String(text || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function titleCaseFlowName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function extractGreenFirstName(messages: GreenSimulationMessage[], fallbackName?: string | null): string {
  for (let i = 0; i < messages.length; i++) {
    const current = String(messages[i]?.ai_content || messages[i]?.content || "");
    const currentNorm = normalizeFlowText(current);
    const isAssistant = messages[i]?.from_me === true || messages[i]?.role === "assistant";
    if (!isAssistant || !currentNorm.includes("COMO POSSO TE CHAMAR")) continue;

    const nextUser = messages.slice(i + 1).find((m) => {
      const isUser = m?.from_me === false || m?.role === "user";
      const raw = String(m?.ai_content || m?.content || "").trim();
      const norm = normalizeFlowText(raw);
      return isUser
        && raw.length <= 60
        && /[a-zA-ZÀ-ÿ]{2,}/.test(raw)
        && !/(CONEXAO GREEN|ENERGIA|DESCONTO|FATURA|CONTA|CELESC|CEMIG|COPEL|EQUATORIAL|ENEL|CPFL|COELBA)/.test(norm)
        && !/^(BOM DIA|BOA TARDE|BOA NOITE|OI|OLA|OII|EAE|E AI|TUDO BEM|TB|OK|BELEZA|BLZ|SIM|NAO|NÃO|CLARO|VAI MANDANDO|MANDA|PODE MANDAR|UHUM|HUM|AHAM|VI|VI AGORA|JA VI|JÁ VI|OK OBRIGADO|OBRIGADO|OBRIGADA|VLW|VALEU|👍|👍🏼|✅|TA|TÁ)$/i.test(raw);
    });

    if (nextUser) return titleCaseFlowName(String(nextUser.content || nextUser.ai_content || "")).split(/\s+/)[0];
  }

  if (fallbackName && /[a-zA-ZÀ-ÿ]{2,}/.test(fallbackName)) {
    return titleCaseFlowName(fallbackName).split(/\s+/)[0];
  }

  return "";
}

function extractBillAmount(text: string): number | null {
  const normalized = String(text || "").replace(/\./g, "").replace(/,/g, ".");
  const moneyMatch = normalized.match(/(?:R\$\s*)?(\d{2,5}(?:\.\d{1,2})?)\s*(?:REAIS|RS|POR MES|MENSAIS|MENSAL)?/i);
  if (!moneyMatch) return null;
  const amount = Number(moneyMatch[1]);
  if (!Number.isFinite(amount) || amount < 50 || amount > 50000) return null;
  return Math.round(amount);
}

function extractDistributorState(text: string): { distributor: string; state: string } | null {
  const norm = normalizeFlowText(text);
  const state = BRAZIL_STATES.find(uf => new RegExp(`\\b${uf}\\b`).test(norm));
  if (!state) return null;

  const distributor = DISTRIBUTOR_ALIASES.find(alias => norm.includes(alias));
  if (distributor) return { distributor, state };

  const beforeState = norm.match(new RegExp(`([A-Z0-9 ]{3,40})\\s*[,/\\- ]+${state}\\b`));
  if (!beforeState) return null;

  const cleaned = beforeState[1]
    .replace(/\b(MINHA|DISTRIBUIDORA|E|ESTADO|EH|E|DE|DA|DO|A|O)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned ? { distributor: cleaned, state } : null;
}

function findDiscountPercentage(knowledgeText: string, distributor: string, state: string): number | null {
  const lines = String(knowledgeText || "").split(/\n+/).map(line => line.trim()).filter(Boolean);
  const normDistributor = normalizeFlowText(distributor);
  const candidateIndexes: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const window = lines.slice(Math.max(0, i - 3), Math.min(lines.length, i + 4)).join(" ");
    const normWindow = normalizeFlowText(window);
    if (normWindow.includes(normDistributor) && new RegExp(`\\b${state}\\b`).test(normWindow)) {
      candidateIndexes.push(i);
    }
  }

  let best: number | null = null;
  for (const idx of candidateIndexes) {
    const window = lines.slice(Math.max(0, idx - 4), Math.min(lines.length, idx + 45)).join("\n");
    const normWindow = normalizeFlowText(window);
    if (!normWindow.includes("DESCONTO")) continue;

    const percentages = [...window.matchAll(/(\d{1,2}(?:[,.]\d+)?)\s*%/g)]
      .map(match => Number(match[1].replace(",", ".")))
      .filter(value => Number.isFinite(value) && value > 0 && value <= 40);

    if (percentages.length > 0) {
      const max = Math.max(...percentages);
      best = best === null ? max : Math.max(best, max);
    }
  }

  return best;
}

export function buildGreenSimulationReply(opts: {
  messages: GreenSimulationMessage[];
  currentUserMessage: string | null | undefined;
  knowledgeText: string;
  fallbackName?: string | null;
}): string | null {
  const current = String(opts.currentUserMessage || "");
  const amount = extractBillAmount(current);
  if (!amount) return null;

  const accountTypeMentioned = /\b(residencial|residencia|comercial|empresa|empresarial)\b/i.test(current);
  const previousAssistantAskedBill = opts.messages.some((m) => {
    const isAssistant = m?.from_me === true || m?.role === "assistant";
    const norm = normalizeFlowText(m?.ai_content || m?.content || "");
    return isAssistant && norm.includes("RESIDENCIAL OU COMERCIAL") && norm.includes("VALOR MEDIO");
  });
  if (!accountTypeMentioned && !previousAssistantAskedBill) return null;

  const conversationText = [
    ...opts.messages.map(m => String(m?.ai_content || m?.content || "")),
    current,
  ].join("\n");
  const location = extractDistributorState(conversationText);
  if (!location) return null;

  const percentage = findDiscountPercentage(opts.knowledgeText, location.distributor, location.state);
  if (percentage === null) return null;

  const monthlySavings = Math.round(amount * (percentage / 100));
  const yearlySavings = monthlySavings * 12;
  const newBill = Math.max(0, amount - monthlySavings);
  const firstName = extractGreenFirstName(opts.messages, opts.fallbackName);
  const namePrefix = firstName ? `${firstName}, ` : "";
  const percentLabel = Number.isInteger(percentage) ? String(percentage) : String(percentage).replace(".", ",");

  return `Show, ${namePrefix}para a ${location.distributor}/${location.state}, o desconto médio é de ${percentLabel}%. Na sua conta de R$ ${amount}, você economizaria cerca de R$ ${monthlySavings} por mês — quase R$ ${yearlySavings} por ano — e sua fatura ficaria perto de R$ ${newBill}. Bora fazer seu cadastro? Só preciso da sua fatura de energia para iniciar.`;
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
CONEXÃO GREEN — ROTEIRO DE REFERÊNCIA (use como guia, NÃO como script rígido)
============================================================
Você é um(a) consultor(a) inteligente da iGreen Energy. A Conexão Green é
UM dos produtos da iGreen Energy (energia por assinatura com desconto na
conta de luz). O roteiro abaixo é
APENAS UM EXEMPLO de como uma conversa boa costuma fluir. Adapte sempre ao
que o cliente diz, com naturalidade humana. Não force etapas, não repita
perguntas já respondidas, e nunca soe robótico(a).

Informações que você precisa coletar ao longo da conversa (na ordem que fizer
sentido — não precisa ser nessa sequência exata):
  • Nome do cliente
  • Distribuidora + estado
  • Tipo da conta (residencial/comercial) e valor médio mensal
  • Fatura de energia (no fim, para iniciar o cadastro)

EXEMPLO DE FLUXO IDEAL (referência, não copie literal):
1) Abertura: "${greeting}, tudo bem? Me chamo ${agentName}, sou da iGreen Energy. Como posso te chamar?"
2) Quando souber o nome → chamar a tool send_product_video(product_key="green",
   intro_message="Prazer em te conhecer, {nome}! Aqui na iGreen Energy a gente
   tem a Conexão Green, nosso serviço de energia por assinatura que te dá
   desconto na conta de luz. Vou te mandar uma reportagem rápida que explica
   como funciona.").
   ${green.has_video ? "O sistema envia o vídeo e agenda automaticamente um follow-up de 2 minutos." : "(Sem vídeo cadastrado: apenas mande a mensagem de texto.)"}
3) Após o cliente reagir ao vídeo → perguntar distribuidora e estado.
4) Ao receber distribuidora/estado → confirmar atendimento de forma humana e
   na MESMA mensagem perguntar tipo da conta + valor médio.
   Ex.: "Show, {nome}, atendemos sua região! Sua conta é residencial ou
   comercial e qual o valor médio mensal dela?"
5) Ao receber tipo + valor → faça a SIMULAÇÃO usando o percentual cadastrado
   na base [PRODUTO: ${green.name}] para aquela distribuidora/estado:
     economia_mes = valor × %  | economia_ano = economia_mes × 12
     conta_nova   = valor − economia_mes  (arredonde para inteiros)
   Apresente os números de forma natural e finalize convidando o cliente a
   enviar a fatura para iniciar o cadastro.

INTELIGÊNCIA E BOM SENSO (mais importante que o roteiro):
- Se o cliente já disse o nome em mensagens anteriores, NÃO pergunte de novo.
  "Bom dia", "oi", "tudo bem", "vai mandando" NÃO são nomes.
- Se o cliente trouxer um assunto fora do roteiro (ex.: "já tenho placas solares",
  "qual o prazo?", "tenho dúvida X"), responda com naturalidade usando a base
  [PRODUTO: ${green.name}] e só depois retome a próxima informação que falta.
- Se o cliente mandar várias mensagens curtas (ex.: "Equatorial" + "Goiás"),
  trate como UMA informação só e responda UMA vez — nunca duplique respostas.
- Pode unir 2 perguntas curtas numa mesma mensagem quando soar natural
  (ex.: distribuidora + estado, tipo + valor). Evite empilhar 3+ perguntas.
- Use o primeiro nome do cliente com moderação (não em toda mensagem).
- Sobre simulação: use APENAS percentuais que existam de fato na base
  [PRODUTO: ${green.name}] para a distribuidora/estado informados. Se não
  houver, diga com transparência que vai confirmar com a equipe — nunca invente.
- O vídeo institucional é enviado UMA vez só por cliente.
============================================================
` : "";

  return `PRODUTOS IGREEN DISPONÍVEIS NA CONTA:
${list}

REGRAS DOS PRODUTOS IGREEN:
- Quando o cliente perguntar sobre um produto específico, use APENAS os trechos
  da base de conhecimento rotulados com [PRODUTO: <nome>] correspondente.
- Para enviar o vídeo institucional de um produto, use a tool send_product_video
  com o product_key correto (green, telecom, expansao). Só funciona para produtos
  que tenham vídeo cadastrado (marcados acima com [vídeo institucional disponível]).

PRODUTOS SEM BASE DE CONHECIMENTO COMPLETA:
- Pode acontecer do cliente chegar perguntando sobre um produto da lista acima
  (ex.: Conexão Telecom, Conexão Expansão) que ainda NÃO tem trechos rotulados
  [PRODUTO: <nome>] na base de conhecimento.
- Nesse caso: NUNCA invente preços, percentuais, prazos, cobertura ou condições.
  Não chute. Não copie informações de outro produto.
- Atenda de forma consultiva e humana:
    1) Reconheça o interesse e use o que você sabe em alto nível pela descrição
       do produto na lista acima (apenas o nome/descrição curta — sem inventar números).
    2) Faça perguntas de qualificação relevantes ao produto (ex.: para Telecom:
       cidade, operadora atual, quantas linhas, fibra ou móvel; para Expansão:
       segmento do negócio, faturamento aproximado, objetivo).
    3) Diga com transparência que vai confirmar os detalhes específicos
       (valores, planos, cobertura) com a equipe responsável e retorna em seguida.
    4) Mantenha o cliente engajado coletando os dados acima — não devolva
       a conversa "vazia".
- Se o cliente insistir em valores/condições que você não tem, seja honesto(a):
  "Deixa eu confirmar isso certinho com a equipe pra não te passar nada errado,
  ok? Enquanto isso, me adianta [próxima pergunta de qualificação]."${greenFlow}`;
}
