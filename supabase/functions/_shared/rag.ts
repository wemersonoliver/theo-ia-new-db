// RAG simples por palavras-chave (sem embeddings). 
// Reduz drasticamente tokens enviados ao Gemini ao incluir
// apenas trechos relevantes da base de conhecimento, em vez do documento inteiro.

const STOPWORDS = new Set([
  "a","o","as","os","de","do","da","dos","das","e","ou","que","com","para","por",
  "em","no","na","nos","nas","um","uma","uns","umas","se","sua","seu","suas","seus",
  "eu","voce","você","tu","ele","ela","nos","nós","vos","eles","elas","mim","comigo",
  "lhe","lhes","meu","minha","ja","já","mais","menos","muito","pouco","tambem","também",
  "isso","isto","aquilo","ai","aí","aqui","ali","la","lá","como","porque","por que",
  "qual","quais","quem","quando","onde","entao","então","sim","nao","não","sobre","ate","até",
  "tem","ter","ser","sou","sao","são","esta","está","estão","estao","fui","foi",
  "minha","quer","quero","posso","pode","poderia","gostaria","oi","ola","olá","bom","boa",
  "dia","tarde","noite","obrigado","obrigada","valeu","favor","pf","pls"
]);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/**
 * Quebra um texto longo em chunks de ~ chunkSize caracteres,
 * tentando respeitar quebras de parágrafo / frase.
 */
export function chunkText(text: string, chunkSize = 800): string[] {
  if (!text) return [];
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    if (current.length + p.length + 2 <= chunkSize) {
      current = current ? `${current}\n\n${p}` : p;
    } else {
      if (current) chunks.push(current);
      if (p.length <= chunkSize) {
        current = p;
      } else {
        // parágrafo gigante: fatiar duro
        for (let i = 0; i < p.length; i += chunkSize) {
          chunks.push(p.slice(i, i + chunkSize));
        }
        current = "";
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Faz a recuperação (R do RAG) dos trechos mais relevantes
 * dada a query do usuário. Usa pontuação por sobreposição de termos.
 *
 * @param query  Pergunta atual do usuário
 * @param documents Lista de textos completos da base de conhecimento
 * @param opts.topK Número de chunks a retornar
 * @param opts.maxChars Limite total de caracteres devolvidos (segurança)
 * @param opts.chunkSize Tamanho alvo de cada chunk
 */
export function retrieveRelevantContext(
  query: string,
  documents: string[],
  opts: { topK?: number; maxChars?: number; chunkSize?: number } = {}
): string {
  const topK = opts.topK ?? 3;
  const maxChars = opts.maxChars ?? 1800;
  const chunkSize = opts.chunkSize ?? 800;

  const allChunks: string[] = [];
  for (const doc of documents) {
    if (!doc) continue;
    allChunks.push(...chunkText(doc, chunkSize));
  }
  if (allChunks.length === 0) return "";

  const queryTerms = tokenize(query);

  // Se a query for muito vazia/genérica (saudação), devolve um header curto
  // do primeiro chunk só pra IA ter um contexto mínimo do negócio.
  if (queryTerms.length === 0) {
    return allChunks[0].slice(0, Math.min(600, maxChars));
  }

  const scored = allChunks.map((chunk) => {
    const chunkNorm = normalize(chunk);
    let score = 0;
    for (const term of queryTerms) {
      // peso por ocorrência (capada) — evita inflar com palavras repetidas
      const occurrences = chunkNorm.split(term).length - 1;
      if (occurrences > 0) score += Math.min(occurrences, 3);
    }
    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const picked: string[] = [];
  let totalChars = 0;
  for (const s of scored) {
    if (s.score <= 0) break;
    if (picked.length >= topK) break;
    if (totalChars + s.chunk.length > maxChars) {
      const remaining = maxChars - totalChars;
      if (remaining > 200) picked.push(s.chunk.slice(0, remaining));
      break;
    }
    picked.push(s.chunk);
    totalChars += s.chunk.length;
  }

  // Se nada bateu, devolve o primeiro chunk como contexto mínimo
  if (picked.length === 0) {
    return allChunks[0].slice(0, Math.min(600, maxChars));
  }

  return picked.join("\n\n---\n\n");
}