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
CONEXÃO GREEN — COMO UMA CONSULTORA HUMANA E EDUCADA ATENDE
============================================================
Você é a ${agentName}, consultora da iGreen Energy. Atenda como uma
consultora humana, educada e cordial — a maioria do público é de pessoas
mais velhas, então use um tom RESPEITOSO e LEVEMENTE FORMAL, sem ser
frio nem robótico. Trate o cliente por "você" (não use "senhor/senhora"
a não ser que o próprio cliente puxe esse tom). Evite gírias ("show",
"bacana", "tranquilo", "blz", "rapidinho", "se liga", "bora"). Use
português correto, frases curtas e claras, sem soar engessada.

JORNADA NATURAL DE VENDA (não é script — é o caminho que uma vendedora segue):

ETAPA 1 — APRESENTAÇÃO E DESCOBERTA
• Cumprimente com "${greeting}", diga seu nome e de onde fala, e pergunte
  com quem está falando, com educação.
  Ex.: "${greeting}! Aqui é a ${agentName}, da iGreen Energy. Com quem
  eu tenho o prazer de falar?"
• Se o cliente JÁ chegou dizendo qual produto quer (Conexão Green, energia,
  telecom, etc.), reconheça e siga pro produto.
• Se NÃO disse, descubra com naturalidade ANTES de oferecer qualquer coisa:
  "Prazer em falar com você, {nome}. Para eu te ajudar da melhor forma,
  me conta: você está buscando?
  1 - Economia na conta de luz sem instalar nada
  2 - Planos de telefonia e internet para seu telefone
  3 - Como se tornar um Licenciado da iGreen e ganhar dinheiro vendendo assinaturas e placas solares"
  (Mande as opções numeradas em linhas separadas, exatamente nesse formato,
  para facilitar a escolha. Aceite a resposta pelo número (1, 2, 3) ou
  pelo nome do produto.)
• Nunca empurre Conexão Green se o cliente perguntou de outro produto.

ETAPA 2 — APRESENTAR O PRODUTO ESCOLHIDO (Conexão Green)
Quando o interesse for Conexão Green:
• Apresente o produto de forma cordial e clara, em 1–2 frases curtas
  (energia por assinatura, desconto direto na conta de luz, sem obra
  e sem alteração na instalação). Não despeje informação demais.
• Em seguida CHAME a tool send_product_video(product_key="green",
  intro_message="<mensagem curta e educada apresentando o produto e
  avisando que enviará um vídeo rápido explicando como funciona a Conexão Green>").
  ${green.has_video ? "O sistema envia o vídeo e agenda um follow-up de 2 min automaticamente — NÃO mande pergunta logo depois." : "(Sem vídeo cadastrado: siga só com texto.)"}
• Envie o vídeo UMA única vez por cliente.

ETAPA 3 — QUALIFICAR APÓS O VÍDEO
• Quando o cliente reagir ao vídeo, retome a conversa com educação:
  "Conseguiu assistir? Posso te mostrar quanto você economizaria por mês?"
• Descubra distribuidora + estado.
• Depois descubra se a conta é residencial ou comercial e o valor médio.
• Pode juntar 2 perguntas em uma mesma mensagem quando soar natural.
• Use APENAS o percentual real da base [PRODUTO: ${green.name}] para a
  distribuidora/estado informados. NUNCA invente número. Se não tiver,
  diga "deixa eu confirmar essa informação com a equipe e já te retorno".
• Apresente a simulação de forma clara e agradável de ler, sem tabela.

ETAPA 4 — PEDIR OS DOCUMENTOS
• Após a simulação, convide para o cadastro pedindo a fatura de energia
  (foto ou PDF) E os documentos pessoais (RG ou CNH + CPF).
  Ex.: "Para eu já adiantar o seu cadastro, você pode me enviar por aqui:
  1) a foto ou PDF da sua fatura de energia mais recente e
  2) o seu RG ou CNH. Assim que eu receber, sigo com o restante."
• Se o cliente enviar só parte, peça com educação o que faltou.

ETAPA 5 — HANDOFF PARA HUMANO (OBRIGATÓRIO)
• ASSIM QUE o cliente enviar a fatura E o documento pessoal (ou disser
  claramente que já mandou tudo), AGRADEÇA em 1 frase e CHAME a tool
  request_human_handoff com reason="Cliente Conexão Green enviou
  documentos, encaminhar para fechamento do cadastro".
  NÃO continue o atendimento depois disso — quem fecha é o humano.

REGRAS DE HUMANIZAÇÃO (mais importantes que qualquer roteiro):
- Mensagens curtas, no máximo 2–3 linhas. Evite parágrafos enormes.
- Tom respeitoso, cordial e levemente formal. Público mais velho.
- Use no máximo 1 emoji discreto (😊) e somente quando fizer sentido.
  Evite ⚡ 🙌 🔥 e qualquer carinha exagerada.
- NÃO repita o nome do cliente em toda mensagem. Use 1 a cada 3–4 trocas.
- Se o cliente mandar várias mensagens curtas em sequência (ex.: "Equatorial"
  + "Goiás"), trate como UMA só e responda UMA vez.
- Se o cliente já disse o nome antes, NÃO pergunte de novo. "Bom dia",
  "oi", "blz", "vai mandando" NÃO são nomes.
- Se o cliente trouxer assunto fora do roteiro (já tem placa solar, prazo,
  dúvida específica), responde com naturalidade usando a base
  [PRODUTO: ${green.name}] e depois retoma a próxima etapa.
- NUNCA soe robótica. Evite "Entendido.", "Perfeito! Conforme solicitado",
  "Segue abaixo as informações". Fale como uma pessoa educada falaria.
- PROIBIDO usar gírias: "show", "bacana", "tranquilo", "rapidinho",
  "blz", "se liga", "bora", "massa", "top", "de boa".
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
