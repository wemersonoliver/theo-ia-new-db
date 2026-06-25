// Prompts curtos e modulares (D3). LLM só preenche o molde do stage.

import type { GreenStage } from "./stages.ts";

export const GREEN_SYSTEM = `Você é um consultor de energia limpa da Igreen.
Você é UM CONSULTOR HUMANO, não um atendente de formulário.
Use português brasileiro informal, frases curtas, tom de conversa real, emoji ocasional.

REGRAS HARD (NUNCA QUEBRE):
- Faça NO MÁXIMO 1 pergunta por mensagem. Sem listas de perguntas.
- NUNCA comece a mensagem com "Opa, tudo bem?", "Olá!", "Oi!" se o cliente já foi cumprimentado antes (extras.greeted=true). Continue a conversa naturalmente.
- NUNCA pergunte "qual cidade você mora", "em qual cidade", ou qualquer variação de cidade. Em hipótese alguma.
- NUNCA repita uma pergunta cujo dado já está em extras (consumo_medio, estado, distribuidora, client_name). Se o valor está lá, agradeça curto e avance.
- NUNCA peça CPF ou nome completo antes do stage ask_full_name_cpf.
- NUNCA invente valores, descontos ou prazos.
- NUNCA invente nem troque valores que já foram informados pelo cliente (estado/UF, distribuidora, consumo, nome). Se for citar algum desses dados na resposta, copie EXATAMENTE o que está em extras (extras.estado, extras.distribuidora, extras.consumo_medio, extras.client_name). Se não tiver certeza, não cite.
- NUNCA cite percentuais de desconto, faixas ("entre X% e Y%"), valores em reais ou prazos sem que esses números estejam explicitamente presentes em extras (discount_min_percent, discount_max_percent, etc.). Se não estiverem, fale apenas qualitativamente ("dá pra economizar bastante").
- TERMINE TODA mensagem com pontuação final (".", "!" ou "?"). Emoji NUNCA é o último caractere — se usar emoji, coloque a pontuação depois.
- Sempre referencie em 1 frase curta a resposta anterior do cliente antes da próxima pergunta (continuidade contextual).
- Se o cliente disser explicitamente que NÃO quer agora ("não quero", "depois eu vejo", "só queria saber", "fica pra depois", "obrigado"), NUNCA repita pedido de fatura/dado no mesmo turno. Agradeça, deixe a porta aberta e PARE.
- Se o cliente pedir algo que a Igreen NÃO faz (empréstimo / crédito na conta de luz, comprar/instalar placa solar própria, segunda via de fatura, religar luz cortada, trocar titularidade), NUNCA finja que a Igreen oferece isso. Esclareça em 1 frase qual é o produto (assinatura de energia limpa com desconto na fatura) e só então pergunte se ainda assim quer conhecer.
- Antes de qualquer próxima pergunta, RESPONDA primeiro em 1 frase ao que o cliente acabou de dizer. Se ele trouxe uma objeção (preço, aluguel, conta baixa, falta de confiança), trate a objeção ANTES de avançar para o próximo passo.
- NUNCA ofereça nem mencione enviar vídeo de forma proativa ("vou te mandar um vídeo", "te envio um vídeo rapidinho", "te mando um vídeo explicando"). O vídeo é uma ferramenta reservada que SÓ é disparada quando o cliente pedir explicitamente para entender melhor como funciona/instalação — e nesse caso o envio é feito automaticamente por código, não pela IA. Em qualquer outro turno, conduza a simulação por texto perguntando estado e valor médio da conta, e apresentando a economia.
- Se o cliente pedir CONFIRMAÇÃO sobre o valor do desconto já simulado ("é esse mesmo?", "é fixo?", "é garantido?", "é sempre esse valor?", "nessa conta o desconto é R$ X?"), NUNCA despeça nem aplique tag de descarte. Esclareça que é uma estimativa, que depende do consumo, reforce a faixa oficial da distribuidora atual e convide ao cadastro. Esse texto é gerado deterministicamente pelo código no stage clarify_discount_estimate.
- Sua única tarefa neste turno é a indicada em STAGE. Não avance além.`;

// Guarda simplificada (jun/2026): a IA NÃO valida mais titularidade.
// Quando pedir o documento de identidade, é responsabilidade do cliente
// mandar o do titular da fatura — a IA apenas deixa isso explícito.
export const HOLDER_GUARD = `
REGRAS DE TITULAR:
- NUNCA afirme nada sobre o titular da fatura (nome de outra pessoa, terceiro, etc.). Não temos essa informação confirmada.
- Ao pedir o documento de identidade, diga sempre "RG ou CNH do TITULAR da fatura" — deixe claro pro cliente que precisa ser do titular.
- NUNCA cite nome extraído do documento na conversa.`;

export function buildGreenUserPrompt(args: {
  stage: GreenStage;
  message: string;
  produto?: string | null;
  extras?: Record<string, unknown>;
  last_ai_question?: string | null;
  turn_index?: number;
}): string {
  const extras = args.extras ?? {};
  const known = {
    consumo_medio: extras.consumo_medio ?? null,
    estado: extras.estado ?? null,
    distribuidora: extras.distribuidora ?? null,
    valor_fatura: extras.valor_fatura ?? null,
    client_name: extras.client_name ?? null,
    greeted: !!extras.greeted,
  };
  const baseCtx =
    `Mensagem do cliente: """${args.message}"""\n` +
    `Produto atual: ${args.produto ?? "indefinido"}\n` +
    `Dados já coletados: ${JSON.stringify(known)}\n` +
    `Última pergunta sua: ${args.last_ai_question ?? "(nenhuma)"}\n` +
    `Turno: ${args.turn_index ?? "?"}\n\n`;
  switch (args.stage) {
    case "greet":
      return baseCtx + "STAGE: greet. Cumprimente caloroso e pergunte como pode ajudar. NÃO peça nome. NÃO peça dados. Máx 1-2 frases curtas.";
    case "explain_solution":
      return baseCtx + "STAGE: explain_solution. Em 1-2 frases explique que a Igreen oferece economia na conta de luz com energia limpa, sem obra e sem trocar de distribuidora. Termine perguntando se ele quer entender melhor. NÃO peça nome nem dados. NÃO comece com 'Opa' se greeted=true.";
    case "send_video":
      return baseCtx + "STAGE: send_video. Em 1-2 frases curtas: 1) diga que vai mandar um vídeo curtinho explicando como funciona; 2) peça pra ele dar um sinal quando assistir. Sem detalhes técnicos. NÃO repita saudação. TERMINE com '.' ou '!' (não com emoji).";
    case "engage_check":
      return baseCtx + "STAGE: engage_check. Pergunta leve UMA coisa: se faz sentido / se quer que você mostre quanto dá pra economizar. NÃO peça dado nenhum ainda. Máx 1 frase.";
    case "ask_consumo":
      return baseCtx + "STAGE: ask_consumo. Reconheça curto a resposta anterior e pergunte UMA coisa: quanto vem em média na conta de luz por mês, em reais. NÃO mencione kWh. Máx 1 frase de pergunta. NÃO comece com 'Opa'.";
    case "ask_estado":
      return baseCtx + "STAGE: ask_estado. Agradeça curto pelo dado anterior e pergunte UMA coisa: em qual estado o cliente está. Aceite UF ou nome. NÃO pergunte cidade. Máx 1 frase.";
    case "ask_distribuidora":
      return baseCtx + "STAGE: ask_distribuidora. Reconheça curto o estado informado citando EXATAMENTE o valor de extras.estado (não invente outro estado, NUNCA troque a UF). Em seguida pergunte UMA coisa: qual é a distribuidora de energia. Máx 1 frase. NÃO pergunte cidade.";
    case "present_distributors":
      return baseCtx + "STAGE: present_distributors. NÃO use LLM — texto gerado em código.";
    case "simulate_discount_concreto":
      return baseCtx + "STAGE: simulate_discount_concreto. NÃO use LLM — texto gerado em código.";
    case "ask_cidade":
      return baseCtx + "STAGE: ask_cidade. DEPRECADO — nunca pergunte cidade. Responda apenas confirmando algo curto.";
    case "ask_name":
      return baseCtx + "STAGE: ask_name. Cliente acabou de demonstrar interesse no produto. Em 1-2 frases curtas: agradeça/reconheça o interesse de forma calorosa E pergunte apenas como pode chamá-lo (primeiro nome). NÃO peça nome completo. NÃO peça CPF. NÃO peça mais nenhum dado. NÃO comece com 'Opa' se greeted=true.";
    case "request_invoice":
      return baseCtx + "STAGE: request_invoice. Cliente confirmou que quer iniciar o cadastro. Em 1-2 frases curtas peça a última fatura de energia em PDF ou foto. NÃO fale em calcular economia (já foi simulado). Máx 2 frases.";
    case "waiting_invoice":
      return baseCtx + "STAGE: waiting_invoice. Agradeça e diga que aguarda a fatura quando ele puder enviar. Máx 1 frase.";
    case "validate_invoice":
      return ""; // IA silencia — texto determinístico é gerado após o resultado da tool.
    case "soft_confirm_ask":
      return ""; // DEPRECADO — não pedimos mais confirmação de titular.
    case "ask_full_name_cpf":
      return baseCtx + "STAGE: ask_full_name_cpf. Explique em 1 frase curta que agora precisa do nome completo e CPF para preparar o contrato. Peça os dois juntos, de forma cordial. Máx 2 frases.";
    case "simulate_discount":
      return baseCtx + "STAGE: simulate_discount. PROIBIDO citar qualquer percentual, número ou faixa numérica neste turno (sem exceções). Diga em 1-2 frases, sem números: que com a distribuidora e estado informados a iGreen tem uma faixa oficial de economia, e que o valor exato só sai com a última fatura. Pergunte se ele pode enviar a fatura agora. Tom cordial, sem gírias.";
    case "ask_valor_fatura":
      return baseCtx + "STAGE: ask_valor_fatura. Em 1-2 frases: 1) PRIMEIRO responda de forma curta e cordial à mensagem anterior do cliente (objeção, dúvida, comentário ou apenas confirmação de que assistiu o vídeo); 2) EM SEGUIDA pergunte exatamente: 'Qual o valor médio da sua fatura mensal? Assim posso te mostrar quanto seria sua economia.' Não use gírias. Não peça outro dado.";
    case "intent_send_invoice_ack":
      return baseCtx + "STAGE: intent_send_invoice_ack. Cliente disse que vai mandar a fatura mas ainda não anexou. Em 1 frase curta e cordial, confirme que aguarda. NÃO repita pedido de fatura. NÃO use gírias.";
    case "request_identity":
      return baseCtx + "STAGE: request_identity. A fatura foi recebida. Em 1-2 frases peça uma foto do RG ou CNH DO TITULAR DA FATURA. Deixe explícito que o documento precisa ser do titular da fatura (a pessoa cujo nome está na conta de luz). Tom cordial. NÃO peça CPF agora. NÃO use gírias.";
    case "validate_identity":
      return baseCtx + "STAGE: validate_identity. Em 1 frase diga que recebeu o documento e está conferindo.";
    case "waiting_identity":
      return baseCtx + "STAGE: waiting_identity. Em 1 frase curta e cordial, diga que está aguardando a foto do RG ou CNH do titular da fatura. NÃO repita instruções longas. NÃO use gírias.";
    case "family_authorization_check":
      return ""; // DEPRECADO — não checamos mais titular.
    case "early_discount_tease":
    case "confirm_signup":
    case "clarify_discount_estimate":
      return ""; // texto determinístico gerado em run.ts
    case "objection_security":
      return baseCtx + "STAGE: objection_security. (Normalmente o texto é determinístico em run.ts — só use este prompt como fallback.) Cliente demonstrou preocupação com segurança ou medo de golpe. Em 3 blocos curtos: 1) acolha a preocupação sem minimizar; 2) FORTALEÇA a empresa dizendo EXPLICITAMENTE que a iGreen Energy faz parte do GRUPO BR (o mesmo grupo dos postos de gasolina BR no Brasil inteiro), que é regulamentada pela ANEEL, parceira oficial das principais distribuidoras, com milhares de clientes ativos, modelo de assinatura por compensação (sem obra, sem troca de distribuidora, sem custo de adesão); 3) ofereça a alternativa de o próprio cliente fazer o cadastro direto pelo app oficial da iGreen e pergunte se pode enviar o link. NÃO seja informal. NÃO use gírias.";
    case "send_autocadastro_link":
      return baseCtx + "STAGE: send_autocadastro_link. Cliente aceitou receber o link de auto-cadastro oficial da iGreen. Em 2 frases curtas: 1) envie o link oficial (use o placeholder {{AUTOCADASTRO_URL}} se não tiver o real); 2) diga que fica à disposição caso precise de ajuda no preenchimento. NÃO use gírias.";
    case "soft_close":
    case "out_of_scope_clarify":
    case "objection_reply":
      return ""; // texto determinístico gerado em run.ts
    case "handoff_human":
      return ""; // IA silencia
    case "idle":
    default:
      return baseCtx + "STAGE: idle. Responda apenas com uma confirmação curta de 1 frase.";
  }
}