// Paleta fixa de cores HSL usada para identificar visualmente cada responsável.
// Mantém contraste em fundo claro/escuro e é independente do tema.
const PALETTE: { bg: string; text: string; border: string; dot: string; ring: string }[] = [
  { bg: "hsl(217 91% 95%)", text: "hsl(217 91% 30%)", border: "hsl(217 91% 75%)", dot: "hsl(217 91% 55%)", ring: "hsl(217 91% 55%)" },
  { bg: "hsl(142 76% 92%)", text: "hsl(142 76% 25%)", border: "hsl(142 76% 70%)", dot: "hsl(142 76% 45%)", ring: "hsl(142 76% 45%)" },
  { bg: "hsl(280 80% 94%)", text: "hsl(280 70% 32%)", border: "hsl(280 70% 75%)", dot: "hsl(280 70% 55%)", ring: "hsl(280 70% 55%)" },
  { bg: "hsl(20 90% 92%)",  text: "hsl(20 80% 32%)",  border: "hsl(20 80% 70%)",  dot: "hsl(20 80% 50%)",  ring: "hsl(20 80% 50%)" },
  { bg: "hsl(340 82% 94%)", text: "hsl(340 72% 35%)", border: "hsl(340 72% 75%)", dot: "hsl(340 72% 55%)", ring: "hsl(340 72% 55%)" },
  { bg: "hsl(190 80% 92%)", text: "hsl(190 80% 28%)", border: "hsl(190 80% 65%)", dot: "hsl(190 80% 45%)", ring: "hsl(190 80% 45%)" },
  { bg: "hsl(48 95% 90%)",  text: "hsl(38 90% 30%)",  border: "hsl(38 90% 65%)",  dot: "hsl(38 90% 50%)",  ring: "hsl(38 90% 50%)" },
  { bg: "hsl(0 0% 92%)",    text: "hsl(0 0% 25%)",    border: "hsl(0 0% 70%)",    dot: "hsl(0 0% 45%)",    ring: "hsl(0 0% 45%)" },
];

function hashId(id: string | null | undefined): number {
  if (!id) return PALETTE.length - 1; // último slot (cinza) para "não atribuído"
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % (PALETTE.length - 1); // reserva último para null
}

export function getAssigneeColor(userId: string | null | undefined) {
  return PALETTE[hashId(userId)];
}

export function getInitials(name?: string | null, fallback = "?"): string {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}