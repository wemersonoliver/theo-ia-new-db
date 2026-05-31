// Qualifier specialist — heurísticas determinísticas.
// Fluxo: greet (open) → present_menu (se ambíguo) → await_choice → routed.

import type { IgreenConversationState } from "../../types.ts";

export type QualifierStage =
  | "greet_open"
  | "ask_name"
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

  // Turno 2: pedir o nome UMA ÚNICA VEZ (ETAPA 1 do roteiro).
  // Se já perguntamos (name_asked=true), avança independente de ter capturado nome —
  // não trava a conversa caso o cliente ignore a pergunta.
  if (!extras.name_asked && !extras.client_name) {
    // Se cliente já citou produto + nome juntos no mesmo turno, run.ts vai promover
    // para route_*. Aqui só sinalizamos ask_name.
    return "ask_name";
  }

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

const NAME_BLOCKLIST = new Set([
  "bom","boa","ola","olá","oi","tudo","bem","áudio","audio","imagem","documento",
  "atlas","ia","bot","cliente","sim","nao","não","ok","obrigado","obrigada",
  "quero","saber","como","funciona","tenho","interesse","conexao","conexão","green",
  "telecom","internet","luz","energia","economia","licenciado","franquia",
]);

export function extractFirstName(msg: string): string | null {
  if (!msg) return null;
  // tenta padrões comuns: "meu nome é X", "sou o/a X", "aqui é o/a X", "me chamo X"
  const patterns = [
    /\bmeu nome[\s\S]{0,5}(?:é|eh)?\s+([A-Za-zÀ-ÿ]{2,30})/i,
    /\b(?:sou|aqui é|aqui eh)\s+(?:o|a|do|da|de)?\s*([A-Za-zÀ-ÿ]{2,30})/i,
    /\bme chamo\s+([A-Za-zÀ-ÿ]{2,30})/i,
    /\bchamo\s+([A-Za-zÀ-ÿ]{2,30})/i,
  ];
  for (const rx of patterns) {
    const m = msg.match(rx);
    if (m?.[1]) {
      const cand = m[1].trim();
      const low = cand.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (!NAME_BLOCKLIST.has(low) && cand.length >= 2) {
        return cand.charAt(0).toUpperCase() + cand.slice(1).toLowerCase();
      }
    }
  }
  // fallback: mensagem é uma única palavra com cara de nome
  const t = msg.trim().replace(/[^\p{L}\s]/gu, "").split(/\s+/);
  if (t.length === 1 && t[0].length >= 2 && t[0].length <= 30) {
    const low = t[0].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (!NAME_BLOCKLIST.has(low)) {
      return t[0].charAt(0).toUpperCase() + t[0].slice(1).toLowerCase();
    }
  }
  return null;
}