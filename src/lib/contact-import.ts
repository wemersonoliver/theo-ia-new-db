import * as XLSX from "xlsx";

export type DuplicateStrategy = "update" | "merge" | "skip";

export interface ParsedRow {
  [key: string]: string;
}

export interface ParseResult {
  headers: string[];
  rows: ParsedRow[];
  source: "spreadsheet" | "vcard";
}

export const CONTACT_FIELDS = [
  { key: "name", label: "Nome", required: true },
  { key: "phone", label: "Telefone", required: true },
  { key: "email", label: "E-mail", required: false },
  { key: "address", label: "Endereço", required: false },
  { key: "notes", label: "Anotações", required: false },
] as const;

export type ContactFieldKey = (typeof CONTACT_FIELDS)[number]["key"];

// Heurística para sugerir mapeamentos automaticamente
const FIELD_HINTS: Record<ContactFieldKey, string[]> = {
  name: ["nome", "name", "contato", "contact", "cliente", "fullname", "full_name"],
  phone: ["telefone", "phone", "celular", "whatsapp", "mobile", "tel", "fone", "número", "numero"],
  email: ["email", "e-mail", "mail", "correio"],
  address: ["endereço", "endereco", "address", "rua", "logradouro"],
  notes: ["notas", "notes", "anotações", "anotacoes", "observações", "observacoes", "obs"],
};

export function suggestMapping(headers: string[]): Record<ContactFieldKey, string | null> {
  const result: Record<ContactFieldKey, string | null> = {
    name: null,
    phone: null,
    email: null,
    address: null,
    notes: null,
  };
  const lowered = headers.map((h) => ({ original: h, lower: h.toLowerCase().trim() }));
  for (const field of CONTACT_FIELDS) {
    const hints = FIELD_HINTS[field.key];
    const found = lowered.find((h) => hints.some((hint) => h.lower.includes(hint)));
    if (found) result[field.key] = found.original;
  }
  return result;
}

export async function parseFile(file: File): Promise<ParseResult> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (ext === "vcf" || ext === "vcard") {
    const text = await file.text();
    return parseVCard(text);
  }
  return parseSpreadsheet(file);
}

async function parseSpreadsheet(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
  if (data.length === 0) return { headers: [], rows: [], source: "spreadsheet" };

  const headers = (data[0] as any[]).map((h) => String(h ?? "").trim()).filter(Boolean);
  const rows: ParsedRow[] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i] as any[];
    if (!row || row.every((c) => !c && c !== 0)) continue;
    const obj: ParsedRow = {};
    headers.forEach((h, idx) => {
      obj[h] = String(row[idx] ?? "").trim();
    });
    rows.push(obj);
  }
  return { headers, rows, source: "spreadsheet" };
}

function parseVCard(text: string): ParseResult {
  const cards = text.split(/BEGIN:VCARD/i).slice(1);
  const rows: ParsedRow[] = [];
  for (const raw of cards) {
    const block = raw.split(/END:VCARD/i)[0];
    // Junta linhas continuadas (vCard usa "\n " ou "\n\t" como continuação)
    const lines = block.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
    const card: ParsedRow = { name: "", phone: "", email: "", address: "", notes: "" };
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx === -1) continue;
      const left = trimmed.slice(0, colonIdx).toUpperCase();
      const value = trimmed.slice(colonIdx + 1).trim();
      if (left.startsWith("FN")) {
        card.name = value;
      } else if (left.startsWith("N") && !card.name) {
        // N:Sobrenome;Nome;...
        const parts = value.split(";").filter(Boolean);
        card.name = [parts[1], parts[0]].filter(Boolean).join(" ").trim();
      } else if (left.startsWith("TEL") && !card.phone) {
        card.phone = value;
      } else if (left.startsWith("EMAIL") && !card.email) {
        card.email = value;
      } else if (left.startsWith("ADR")) {
        // ADR:;;Rua;Cidade;Estado;CEP;País
        const parts = value.split(";").map((s) => s.trim()).filter(Boolean);
        if (parts.length && !card.address) card.address = parts.join(", ");
      } else if (left.startsWith("NOTE") && !card.notes) {
        card.notes = value;
      }
    }
    if (card.name || card.phone) rows.push(card);
  }
  return {
    headers: ["name", "phone", "email", "address", "notes"],
    rows,
    source: "vcard",
  };
}

export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";
  // Brasileiro: força 13 dígitos canônicos com 9 do celular
  if (digits.length === 10) {
    return "55" + digits.slice(0, 2) + "9" + digits.slice(2);
  }
  if (digits.length === 11) {
    return "55" + digits;
  }
  if (digits.length === 12 && digits.startsWith("55")) {
    return "55" + digits.slice(2, 4) + "9" + digits.slice(4);
  }
  return digits;
}

export function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ["nome", "telefone", "email", "endereco", "anotacoes"],
    ["João Silva", "+55 11 91234-5678", "joao@exemplo.com", "Rua A, 100 - São Paulo/SP", "Cliente VIP"],
    ["Maria Souza", "11987654321", "maria@exemplo.com", "", ""],
  ]);
  ws["!cols"] = [{ wch: 20 }, { wch: 20 }, { wch: 28 }, { wch: 32 }, { wch: 24 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Contatos");
  XLSX.writeFile(wb, "modelo-contatos.xlsx");
}