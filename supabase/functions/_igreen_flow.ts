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
  const lines = String(knowledgeText || "").split(/\n+/).map(line => line.trim());
  const normDistributor = normalizeFlowText(distributor);
  // Procura cabeçalho da seção tipo "Celesc (SC)" ou "ENEL RJ" — linha curta
  // contendo distribuidora E estado, que marca início do bloco específico.
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.length > 80) continue;
    const norm = normalizeFlowText(line);
    if (!norm.includes(normDistributor)) continue;
    if (!new RegExp(`\\b${state}\\b`).test(norm)) continue;
    // Evita linhas de prosa (ex.: "...Celesc SC, energisa...")
    if (/[,.;:]/.test(line) && line.length > 40) continue;
    headerIdx = i;
    break;
  }
  if (headerIdx === -1) return null;

  // Bloco vai até o próximo cabeçalho de distribuidora/estado em CAPS ou
  // até linha de UF em caixa alta (próxima seção tipo "SANTA CATARINA").
  let endIdx = lines.length;
  for (let i = headerIdx + 1; i < lines.length && i < headerIdx + 60; i++) {
    const line = lines[i];
    if (!line) continue;
    // Próximo cabeçalho de estado (todo em CAIXA ALTA, sem dígitos)
    if (/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]{4,}$/.test(line) && !/\d/.test(line) && line.length < 40) {
      endIdx = i; break;
    }
    // Próxima distribuidora com (UF)
    const otherUf = line.match(/\(([A-Z]{2})\)/);
    if (otherUf && otherUf[1] !== state && line.length < 60) {
      endIdx = i; break;
    }
  }

  const block = lines.slice(headerIdx, endIdx).join("\n");
  if (!/desconto/i.test(block)) return null;

  // Pega só o trecho a partir de "Descontos" para ignorar prazos/dias.
  const descIdx = block.search(/Descontos?\s*:/i);
  const target = descIdx >= 0 ? block.slice(descIdx) : block;

  const percentages = [...target.matchAll(/(\d{1,2}(?:[,.]\d+)?)\s*%/g)]
    .map(m => Number(m[1].replace(",", ".")))
    .filter(v => Number.isFinite(v) && v > 0 && v <= 40);

  if (percentages.length === 0) return null;

  // Usa a faixa típica residencial: maior % da menor faixa de consumo (bônus B
  // costuma ser o oferecido). Heurística: pega a mediana, que evita o extremo
  // de bônus C/D (acima de 1.000 kWh) e o piso A.
  const sorted = [...percentages].sort((a, b) => a - b);
  const mid = sorted[Math.floor(sorted.length / 2)];
  return mid;
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

  return `Perfeito, ${namePrefix}para a ${location.distributor}/${location.state}, o desconto médio é de ${percentLabel}%. Na sua conta de R$ ${amount}, você economizaria cerca de R$ ${monthlySavings} por mês, quase R$ ${yearlySavings} por ano, e sua fatura ficaria perto de R$ ${newBill}. Para iniciar seu cadastro, pode me enviar uma foto ou PDF da sua fatura de energia?`;
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
• SEMPRE comece a conversa cumprimentando com "${greeting}", dizendo seu
  nome e de onde fala, e perguntando com quem está falando. NÃO PULE essa
  etapa NUNCA, mesmo que o cliente já tenha aberto a conversa pedindo um
  produto específico (ex.: "quero saber da conexão green"). Nesses casos,
  reconheça o interesse em 1 linha curta, mas AINDA ASSIM apresente-se e
  peça o nome ANTES de continuar.
  Ex. (cliente já citou o produto):
    "${greeting}! Que ótimo seu interesse na Conexão Green 😊

    Aqui é a ${agentName}, da iGreen Energy. Antes de te explicar tudo,
    com quem eu tenho o prazer de falar?"
  Ex. (cliente não citou produto):
    "${greeting}! Aqui é a ${agentName}, da iGreen Energy. Com quem eu
    tenho o prazer de falar?"
• SÓ avance para apresentar o produto DEPOIS que o cliente disser o nome.
  Quando souber o nome, chame save_green_lead_field(field="nome_cliente",
  value="<primeiro nome>") nesse mesmo turno.
• Se o cliente NÃO disse qual produto quer, depois do nome descubra com
  naturalidade ANTES de oferecer qualquer coisa:
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
Quando o interesse for Conexão Green (E você JÁ tiver o nome do cliente —
se ainda não tiver, volte para ETAPA 1 e peça o nome antes):
• Apresente o produto de forma cordial e clara, em 1–2 frases curtas
  (energia por assinatura, desconto direto na conta de luz, sem obra
  e sem alteração na instalação). Não despeje informação demais.
• Em seguida CHAME a tool send_product_video(product_key="green",
  intro_message="<mensagem curta e educada apresentando o produto e
  avisando que enviará um vídeo rápido explicando como funciona a Conexão Green>").
  ${green.has_video ? "O sistema envia o vídeo e agenda um follow-up de 2 min automaticamente — NÃO mande pergunta logo depois." : "(Sem vídeo cadastrado: siga só com texto.)"}
• Envie o vídeo UMA única vez por cliente.

ETAPA 3 — QUALIFICAR APÓS O VÍDEO
• Quando o cliente reagir ao vídeo, retome a conversa de forma fluida,
  SEM cumprimentar de novo (nada de "boa tarde", "olá", "oi"). A conversa
  já está em andamento. NESSE MESMO TURNO, ANTES de responder, chame a
  tool add_contact_tag(tag="em atendimento") — o sistema move o card
  automaticamente para a etapa "Iniciou atendimento". Use algo como:
  "Perfeito, {nome}! Posso te mostrar quanto você economizaria por mês?
   Para isso, preciso saber qual a sua distribuidora de energia e em qual
   estado você mora."
• Quando o cliente responder a distribuidora e o estado, confirme que
  atendemos a região ANTES de pedir o valor. SALVE os dados chamando
  save_green_lead_field(field="distribuidora", value="...") e
  save_green_lead_field(field="estado", value="..."). Exemplo:
  "Ótimo! Atendemos sua região.
   E a sua conta é residencial ou comercial, {nome}? Qual o valor médio
   da sua fatura mensal?"
  (não cite o nome da distribuidora nessa frase para não soar mecânico.)
• Quando o cliente disser o tipo de conta e/ou o valor, salve também com
  save_green_lead_field (campos 'tipo_conta' e 'valor_fatura'). E quando
  ele disser o primeiro nome dele em qualquer momento, salve com
  save_green_lead_field(field="nome_cliente", value="<primeiro nome>").
• Use APENAS o percentual real da base [PRODUTO: ${green.name}] para a
  distribuidora/estado informados. NUNCA invente número, NUNCA chute
  "média de 20%" ou similar. Se não encontrar o percentual exato da
  distribuidora do cliente na base, responda com transparência:
  "Deixa eu confirmar o desconto exato da sua distribuidora com a equipe
  e já te retorno, tudo bem?" e siga pedindo a fatura para o cadastro.
• Apresente a simulação de forma clara e agradável de ler, sem tabela.

ETAPA 4 — PEDIR OS DOCUMENTOS
• Após a simulação, peça PRIMEIRO a fatura de energia (foto ou PDF).
  Ex.: "Para eu já adiantar o seu cadastro, me envia por aqui a foto ou
  PDF da sua fatura de energia mais recente."

ETAPA 5 — VALIDAR A FATURA
• Quando o cliente enviar a fatura, você receberá no contexto o conteúdo
  extraído da imagem/PDF. Identifique o NOME DO TITULAR impresso e o
  VALOR e CHAME a tool validate_green_invoice(extracted_name="...",
  extracted_value=...).
• Se a tool retornar match=true:
    - Chame add_contact_tag(tag="enviou fatura") (o sistema move o card
      automaticamente para "Enviou fatura de energia").
    - Agradeça em 1 frase e peça o RG ou CNH DO TITULAR para finalizar.
• Se retornar match=false:
    - NÃO adicione tag.
    - Explique com educação: "Para o cadastro, a conta de energia precisa
      estar no nome de quem vai assinar o contrato. O titular da conta
      (NOME DO TITULAR) pode dar continuidade aqui com a gente?"
• TITULAR ALTERNATIVO — se o cliente CONFIRMAR que o titular da fatura é
  familiar/cônjuge/responsável e que pode dar continuidade ao cadastro
  (ex.: "pode sim, é minha mãe", "sim, sou o marido dela, ela autoriza",
  "ok pode usar o nome dela"), você DEVE OBRIGATORIAMENTE, no MESMO turno:
    1) Chamar save_green_lead_field(field="nome_cliente", value="<primeiro
       nome do titular da fatura>"). A partir de agora o "titular" oficial
       passa a ser o nome da fatura — toda validação seguinte usa esse nome.
    2) Chamar add_contact_tag(tag="enviou fatura") — o sistema move o card
       para "Enviou fatura de energia".
    3) Agradecer em 1 frase e pedir o RG ou CNH DO TITULAR DA FATURA.
  NUNCA agradeça e siga pedindo documento sem chamar essas duas tools — se
  você esquecer, o CRM não se move e o atendimento trava.

ETAPA 6 — VALIDAR O DOCUMENTO DE IDENTIFICAÇÃO
• Quando o cliente enviar o RG/CNH, identifique o NOME COMPLETO impresso
  e CHAME validate_green_identity(extracted_name="...").
• Se retornar match=true:
    - Chame add_contact_tag(tag="enviou documento").
    - O sistema notifica a equipe, transfere para humano e envia a
      mensagem de encerramento automaticamente. NÃO escreva nada depois.
• Se retornar match=false:
    - NÃO adicione tag. Peça com educação o documento DO TITULAR da fatura.

REGRA GERAL DAS TOOLS:
- NUNCA cite o nome de uma tag ou tool numa mensagem ao cliente.
- NUNCA pule uma validação: SEMPRE chame validate_green_invoice quando
  receber fatura e validate_green_identity quando receber documento.
- NUNCA chame add_contact_tag('enviou fatura' ou 'enviou documento') sem
  ter executado a validação correspondente e recebido match=true.

REGRAS DE HUMANIZAÇÃO (mais importantes que qualquer roteiro):
- SEMPRE quebre sua resposta em 2 a 3 BLOCOS CURTOS, separados por UMA
  LINHA EM BRANCO (dupla quebra de linha "\\n\\n"). Cada bloco vira uma
  mensagem separada no WhatsApp, com pausa de ~2s entre elas, deixando
  a conversa mais humana. Nunca mande um único parágrafo gigante.
  Exemplo de formato correto para apresentar a Conexão Green:
    "Que ótimo seu interesse na Conexão Green! 😊

    É a nossa solução de energia por assinatura, que te dá desconto na
    conta de luz todo mês, sem precisar de obra ou instalação.

    Vou te enviar um vídeo rápido explicando como funciona."
- Cada bloco com no máximo 2–3 linhas. Evite parágrafos enormes.
- Tom respeitoso, cordial e levemente formal. Público mais velho.
- PROIBIDO usar travessão (— ou –) em qualquer mensagem. Travessão é
  marca registrada de texto de IA. Use vírgula, ponto, dois-pontos ou
  quebra de linha no lugar.
- NUNCA cumprimente o cliente mais de uma vez na mesma conversa. Se já
  disse "bom dia/boa tarde/olá" antes, não repita. A conversa é contínua.
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
