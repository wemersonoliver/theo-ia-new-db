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