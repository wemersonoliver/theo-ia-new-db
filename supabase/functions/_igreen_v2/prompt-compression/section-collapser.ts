export function collapseToolOutput(text: string, maxChars = 600): { text: string; collapsed: boolean } {
  if (text.length <= maxChars) return { text, collapsed: false };
  const head = text.slice(0, Math.floor(maxChars * 0.6));
  const tail = text.slice(-Math.floor(maxChars * 0.2));
  return { text: `${head}\n…[colapsado ${text.length - head.length - tail.length} chars]…\n${tail}`, collapsed: true };
}
export function summarizeList(items: string[], maxItems = 5): { text: string; collapsed: boolean } {
  if (items.length <= maxItems) return { text: items.map(i => `- ${i}`).join("\n"), collapsed: false };
  const head = items.slice(0, maxItems).map(i => `- ${i}`).join("\n");
  return { text: `${head}\n- …+${items.length - maxItems} itens omitidos`, collapsed: true };
}
