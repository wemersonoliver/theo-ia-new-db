// Shared phone normalization for Brazilian numbers.
// Resolve o famoso "nono dígito": números brasileiros de celular devem ter 13 dígitos
// (55 + DDD + 9 + 8 dígitos). Alguns aparelhos/JIDs do WhatsApp omitem o 9, criando
// conversas duplicadas (ex: 558597627354 vs 5585997627354).
//
// Esta função sempre retorna a forma CANÔNICA com o 9, quando aplicável:
// - 10 dígitos (DDD + 8): assume celular, prefixa "55" + insere "9"
// - 11 dígitos (DDD + 9 + 8): prefixa "55"
// - 12 dígitos (55 + DDD + 8): insere "9" após o DDD
// - 13 dígitos (55 + DDD + 9 + 8): retorna como está
// - outros: retorna apenas os dígitos

export function normalizeBrazilianPhone(raw: string | null | undefined): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";

  // 10 dígitos: DDD + 8 (celular antigo sem 9) -> 55 + DDD + 9 + 8
  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const rest = digits.slice(2);
    return `55${ddd}9${rest}`;
  }

  // 11 dígitos: DDD + 9 + 8 -> 55 + tudo
  if (digits.length === 11) {
    return `55${digits}`;
  }

  // 12 dígitos começando com 55: 55 + DDD + 8 (faltou o 9) -> insere 9
  if (digits.length === 12 && digits.startsWith("55")) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    // Apenas insere 9 se for celular (DDD válido brasileiro 11-99)
    const dddNum = parseInt(ddd, 10);
    if (dddNum >= 11 && dddNum <= 99) {
      return `55${ddd}9${rest}`;
    }
    return digits;
  }

  // 13 dígitos canônicos
  if (digits.length === 13 && digits.startsWith("55")) {
    return digits;
  }

  return digits;
}
