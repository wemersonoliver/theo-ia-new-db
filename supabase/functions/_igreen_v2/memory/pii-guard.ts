// Phase 5 — PII guard. Mascara CPF, RG, CNPJ, document_id, telefones em texto.

const CPF_RE = /\b(\d{3})\.?(\d{3})\.?(\d{3})-?(\d{2})\b/g;
const CNPJ_RE = /\b(\d{2})\.?(\d{3})\.?(\d{3})\/?(\d{4})-?(\d{2})\b/g;
const RG_RE = /\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dXx]\b/g;
const PHONE_RE = /\b(\+?55)?\s?\(?(\d{2})\)?\s?9?\d{4}-?\d{4}\b/g;

export function maskCpf(s: string): string {
  return s.replace(CPF_RE, (_m, _a, b, _c, d) => `***.${b}.***-${d}`);
}
export function maskCnpj(s: string): string {
  return s.replace(CNPJ_RE, (_m, a, _b, c, _d, e) => `${a}.***.${c}/****-${e}`);
}
export function maskRg(s: string): string {
  return s.replace(RG_RE, "**.***.***-*");
}
export function maskPhone(s: string): string {
  return s.replace(PHONE_RE, (_m, _cc, ddd) => `(${ddd}) ****-****`);
}

export function maskAll(s: string): string {
  if (!s) return s;
  return maskPhone(maskRg(maskCnpj(maskCpf(s))));
}

export function maskForLogs(obj: unknown): unknown {
  if (obj == null) return obj;
  if (typeof obj === "string") return maskAll(obj);
  if (Array.isArray(obj)) return obj.map(maskForLogs);
  if (typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (/document_id|cpf|rg|cnpj/i.test(k) && typeof v === "string") {
        out[k] = maskAll(v);
      } else {
        out[k] = maskForLogs(v);
      }
    }
    return out;
  }
  return obj;
}