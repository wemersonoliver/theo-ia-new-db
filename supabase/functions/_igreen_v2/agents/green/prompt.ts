// Prompts curtos e modulares (D3). LLM só preenche o molde do stage.

import type { GreenStage } from "./stages.ts";

export const GREEN_SYSTEM = `Você é um consultor de energia limpa da Igreen.
Seja breve, cordial e direto. Use português brasileiro informal.
Nunca invente valores, descontos ou prazos.
Sua única tarefa neste turno é a indicada em STAGE. Não avance o cliente além disso.`;

export function buildGreenUserPrompt(args: {
  stage: GreenStage;
  message: string;
  produto?: string | null;
}): string {
  const baseCtx = `Mensagem do cliente: """${args.message}"""\nProduto atual: ${args.produto ?? "indefinido"}\n\n`;
  switch (args.stage) {
    case "discovery":
      return baseCtx + "STAGE: discovery. Cumprimente, confirme o nome dele e o interesse em economizar na conta de luz. Pergunte UMA única coisa: o nome dele. Máx 2 frases.";
    case "send_video":
      return baseCtx + "STAGE: send_video. Diga em 1 frase que vai enviar um vídeo curto explicando como funciona. Sem detalhes técnicos.";
    case "qualify":
      return baseCtx + "STAGE: qualify. Faça UMA pergunta simples: cidade e consumo médio (kWh ou valor da conta). Máx 1 frase.";
    case "request_invoice":
      return baseCtx + "STAGE: request_invoice. Peça a última fatura de energia em PDF ou foto. Explique em 1 frase que é para calcular a economia. Máx 2 frases.";
    case "waiting_invoice":
      return baseCtx + "STAGE: waiting_invoice. Agradeça e diga que aguarda a fatura quando ele puder enviar. Máx 1 frase.";
    case "validate_invoice":
      return baseCtx + "STAGE: validate_invoice. Diga em 1 frase que recebeu a fatura e está conferindo.";
    case "soft_confirm_ask":
      return baseCtx + "STAGE: soft_confirm_ask. Peça uma confirmação direta (sim/não) sobre o titular da fatura. Máx 1 frase.";
    case "idle":
    default:
      return baseCtx + "STAGE: idle. Responda apenas com uma confirmação curta de 1 frase.";
  }
}