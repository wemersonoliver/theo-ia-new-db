// Validação determinística de "nome de pessoa" para uso em variáveis de cadência.
// Retorna o nome normalizado (Title Case) se a string parecer um nome humano real,
// ou null se for emoji, número, frase, status, palavra genérica, etc.
//
// É usado em:
//  - custom-followup-enroll (gate antes de iniciar cadência)
//  - custom-followup-dispatcher (loadVariables → {{primeiro_nome}})
//  - followup-generate-sequence / system-followup-generate-sequence (IA)

const BLACKLIST = new Set([
  "user", "usuario", "usuário", "cliente", "client", "clientes",
  "whatsapp", "wpp", "zap", "test", "teste", "tests",
  "lead", "leads", "contato", "contact", "suporte", "support",
  "atendimento", "vendas", "comercial", "admin", "administrador",
  "theo", "theoia", "bot", "ia", "ai",
  "eu", "ele", "ela", "voce", "você",
  "mae", "mãe", "pai", "amor", "vida", "anjo", "deus",
  "boss", "chefe", "patrao", "patrão",
  // Marcadores de mídia (nunca são nomes)
  "audio", "áudio", "documento", "doc", "imagem", "image", "foto", "video", "vídeo",
  // Push names genéricos vistos em produção
  "atlas",
]);

// Remove emojis, símbolos pictográficos, bandeiras, etc.
function stripEmoji(input: string): string {
  try {
    return input.replace(/\p{Extended_Pictographic}/gu, "");
  } catch {
    // Fallback para runtimes sem suporte a \p{}
    return input.replace(/[\u2600-\u27BF\uD83C-\uDBFF\uDC00-\uDFFF]/g, "");
  }
}

function titleCaseWord(w: string): string {
  if (!w) return w;
  const lower = w.toLowerCase();
  // Preserva conectores em minúsculas no meio do nome
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export interface PersonName {
  fullName: string;
  firstName: string;
}

export function extractPersonName(raw: string | null | undefined): PersonName | null {
  if (!raw) return null;
  let s = String(raw).trim();
  if (!s) return null;

  // Rejeita se contém URL, @, ou estrutura de mensagem
  if (/(https?:\/\/|www\.|@)/i.test(s)) return null;

  // Tira emojis
  s = stripEmoji(s).trim();
  if (!s) return null;

  // Tira pontuação de borda / repetida
  s = s.replace(/^[^\p{L}]+|[^\p{L}\s]+$/gu, "").trim();
  if (!s) return null;

  // Rejeita se tem dígitos no meio (telefone, codinome 123)
  if (/\d/.test(s)) return null;

  // Rejeita frases longas (>4 palavras = status/recado)
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 4) return null;

  // Conta letras alfabéticas totais
  const letters = (s.match(/[\p{L}]/gu) || []).length;
  if (letters < 3) return null;

  // Primeira palavra precisa ter pelo menos 3 letras alfabéticas
  const firstRaw = words[0];
  const firstLetters = (firstRaw.match(/[\p{L}]/gu) || []).join("");
  if (firstLetters.length < 3) return null;

  const firstLower = firstLetters.toLowerCase();
  if (BLACKLIST.has(firstLower)) return null;

  // Rejeita se a string inteira (lowercased, espaços removidos) está na blacklist
  if (BLACKLIST.has(s.toLowerCase().replace(/\s+/g, ""))) return null;

  // Normaliza Title Case (mantém apóstrofos/hífens)
  const fullName = words
    .filter((w) => /[\p{L}]/u.test(w))
    .map(titleCaseWord)
    .join(" ")
    .trim();

  if (!fullName) return null;

  const firstName = titleCaseWord(firstLetters);
  return { fullName, firstName };
}

// ============================================================
// Extrai nome de pessoa a partir de UMA MENSAGEM livre do cliente.
// Aceita coisas como:
//   "Bom dia, me chamo Emerson"   -> Emerson
//   "Olá, meu nome é Maria Silva" -> Maria Silva
//   "[Áudio transcrito] Oi, sou o João"   -> João
//   "pode me chamar de Zé"        -> Zé
// Retorna null se não conseguir identificar um nome confiável.
// ============================================================
const GREETING_PATTERNS = [
  /^bom\s*dia[\s,.!]*/i,
  /^boa\s*tarde[\s,.!]*/i,
  /^boa\s*noite[\s,.!]*/i,
  /^ol[áa]+[\s,.!]*/i,
  /^oi+[\s,.!]*/i,
  /^e\s*a[ií][\s,.!]*/i,
  /^opa[\s,.!]*/i,
  /^salve[\s,.!]*/i,
  /^tudo\s*(bem|bom|tranquilo)[\s,.?!]*/i,
  /^como\s*vai[\s,.?!]*/i,
  /^prazer[\s,.!]*/i,
];

const INTRO_PATTERNS = [
  /^me\s*chamo\s+/i,
  /^meu\s*nome\s*[ée]\s+/i,
  /^o\s*meu\s*nome\s*[ée]\s+/i,
  /^sou\s*(o|a)\s+/i,
  /^eu\s*sou\s*(o|a)?\s*/i,
  /^aqui\s*[ée]?\s*(o|a)\s+/i,
  /^aqui\s*quem\s*fala\s*[ée]\s*(o|a)?\s*/i,
  /^pode\s*me\s*chamar\s*de\s+/i,
  /^[ée]\s*(o|a)\s+/i,
  /^chamo[\s-]*me\s+/i,
];

function stripLeadingGreetings(input: string): string {
  let s = input.trim();
  // Remove até 2 saudações encadeadas ("Oi, bom dia, ...")
  for (let i = 0; i < 2; i++) {
    let changed = false;
    for (const re of GREETING_PATTERNS) {
      if (re.test(s)) {
        s = s.replace(re, "").trim();
        changed = true;
        break;
      }
    }
    if (!changed) break;
  }
  return s;
}

export function extractIntroducedName(raw: string | null | undefined): PersonName | null {
  if (!raw) return null;
  let s = String(raw).trim();
  if (!s) return null;

  // Remove marcador de transcrição
  s = s.replace(/^\[(?:áudio|audio)\s*transcrito\]\s*/i, "").trim();
  s = s.replace(/^\[(?:áudio|audio|imagem|image|foto|documento|video|vídeo)\][\s:-]*/i, "").trim();
  if (!s) return null;

  // Tira emojis
  s = stripEmoji(s).trim();
  if (!s) return null;

  // Considera apenas a PRIMEIRA frase (até ., !, ?, \n)
  const firstSentence = s.split(/[.!?\n]/)[0]?.trim() || s;
  let work = firstSentence;

  // Remove saudações iniciais
  work = stripLeadingGreetings(work);

  // Remove vírgulas que sobraram do começo
  work = work.replace(/^[,;:\-\s]+/, "").trim();

  // Tenta achar um padrão de introdução explícito ("me chamo X", "meu nome é X")
  let candidate: string | null = null;
  for (const re of INTRO_PATTERNS) {
    if (re.test(work)) {
      candidate = work.replace(re, "").trim();
      break;
    }
  }

  // Se nenhuma intro explícita, mas o restante é curto (até 3 palavras alfabéticas),
  // assume que o restante É o nome (caso: "Bom dia, Emerson")
  if (!candidate) {
    const w = work.split(/\s+/).filter(Boolean);
    if (w.length > 0 && w.length <= 3 && /^[\p{L}\s'-]+$/u.test(work)) {
      candidate = work;
    }
  }

  if (!candidate) return null;

  // Limpa pontuação de borda e limita a 3 palavras
  candidate = candidate
    .replace(/[,;:.!?].*$/, "")
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(" ");

  return extractPersonName(candidate);
}

// Helper: rendering de templates com fallback vazio.
// Limpa pontuação/espaços órfãos depois de substituir a variável por "".
export function cleanRenderedTemplate(text: string): string {
  if (!text) return "";
  let out = text;
  // " , " → ", "  ;  " ," → ","
  out = out.replace(/\s+,/g, ",");
  // ",," → ","
  out = out.replace(/,{2,}/g, ",");
  // "( ," / ", )" e similares
  out = out.replace(/\(\s*,\s*/g, "(").replace(/\s*,\s*\)/g, ")");
  // ", ?" / ", !" / ", ." → "?", "!", "."
  out = out.replace(/,\s*([?!.])/g, "$1");
  // espaços antes de pontuação
  out = out.replace(/\s+([?!.,;:])/g, "$1");
  // espaços duplicados
  out = out.replace(/[ \t]{2,}/g, " ");
  // ", " no início da linha
  out = out.replace(/(^|\n)\s*,\s*/g, "$1");
  // " ," antes de quebra de linha
  out = out.replace(/\s*,\s*\n/g, "\n");
  return out.trim();
}