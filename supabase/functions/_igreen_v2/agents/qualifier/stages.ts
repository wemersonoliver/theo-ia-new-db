// Qualifier specialist — heurísticas determinísticas.
// Fluxo: greet (open) → present_menu (se ambíguo) → await_choice → routed.

import type { IgreenConversationState } from "../../types.ts";

export type QualifierStage =
  | "greet_open"
  | "present_menu"
  | "route_green"
  | "route_telecom"
  | "route_expansao"
  | "menu_repeat"
  | "idle";

export function detectProductMention(msg: string): "green" | "telecom" | "expansao" | null {
  const m = (msg ?? "").toLowerCase();
  if (/\b(energia por assinatura|conta de luz|fatura de luz|fatura de energia|economizar na (luz|conta|energia)|energia solar|solar|placa solar|igreen green|conex[aã]o green)\b/.test(m)) return "green";
  if (/\b(telefonia|internet|celular|chip|telecom|plano de telefone|m[oó]vel)\b/.test(m)) return "telecom";
  if (/\b(licenciad|franquia|vender placa|ganhar dinheiro|expans[aã]o|representante|revendedor)\b/.test(m)) return "expansao";
  return null;
}

export function parseMenuChoice(msg: string): "green" | "telecom" | "expansao" | null {
  const m = (msg ?? "").trim().toLowerCase();
  if (/^(1\b|um\b|primeiro|op[cç][aã]o\s*1|energia|luz|assinatura|economia|economizar)/.test(m)) return "green";
  if (/^(2\b|dois\b|segundo|op[cç][aã]o\s*2|telefonia|internet|celular|chip|telecom)/.test(m)) return "telecom";
  if (/^(3\b|tr[eê]s\b|terceiro|op[cç][aã]o\s*3|licenciad|ganhar dinheiro|vender|franquia|expans[aã]o)/.test(m)) return "expansao";
  return null;
}

export function decideQualifierStage(
  state: Pick<IgreenConversationState, "extras">,
  message: string,
): QualifierStage {
  const extras = (state.extras ?? {}) as Record<string, unknown>;

  // Turno 1: apenas saudar abertamente, sem menu.
  if (!extras.greeted) return "greet_open";

  // Se já apresentou menu, tenta extrair escolha.
  if (extras.menu_presented) {
    const choice = parseMenuChoice(message);
    if (choice === "green") return "route_green";
    if (choice === "telecom") return "route_telecom";
    if (choice === "expansao") return "route_expansao";
    return "menu_repeat";
  }

  // Já saudou mas ainda não mostrou menu: se cliente cita produto, roteia direto.
  const hint = detectProductMention(message);
  if (hint === "green") return "route_green";
  if (hint === "telecom") return "route_telecom";
  if (hint === "expansao") return "route_expansao";

  return "present_menu";
}