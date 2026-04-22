import { useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FileSpreadsheet,
  FileText,
  Download,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  CONTACT_FIELDS,
  type ContactFieldKey,
  type DuplicateStrategy,
  type ParseResult,
  parseFile,
  suggestMapping,
  normalizePhone,
  downloadTemplate,
} from "@/lib/contact-import";
import { toast } from "sonner";

type Step = "upload" | "mapping" | "preview" | "importing";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (
    rows: Array<{
      name?: string | null;
      phone: string;
      email?: string | null;
      address?: string | null;
      notes?: string | null;
    }>,
    strategy: DuplicateStrategy,
  ) => Promise<unknown>;
  isPending: boolean;
}

const NONE = "__none__";

export function ContactImportDialog({ open, onOpenChange, onImport, isPending }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [mapping, setMapping] = useState<Record<ContactFieldKey, string | null>>({
    name: null,
    phone: null,
    email: null,
    address: null,
    notes: null,
  });
  const [strategy, setStrategy] = useState<DuplicateStrategy>("merge");
  const [parsing, setParsing] = useState(false);

  function reset() {
    setStep("upload");
    setFile(null);
    setParsed(null);
    setMapping({ name: null, phone: null, email: null, address: null, notes: null });
    setStrategy("merge");
  }

  function handleClose(o: boolean) {
    if (!o && !isPending) reset();
    onOpenChange(o);
  }

  async function handleFile(f: File) {
    setParsing(true);
    try {
      const result = await parseFile(f);
      if (result.rows.length === 0) {
        toast.error("Nenhum contato encontrado no arquivo");
        return;
      }
      setFile(f);
      setParsed(result);
      setMapping(suggestMapping(result.headers));
      setStep("mapping");
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível ler o arquivo. Verifique o formato.");
    } finally {
      setParsing(false);
    }
  }

  // Linhas processadas com base no mapeamento
  const processedRows = useMemo(() => {
    if (!parsed) return [];
    return parsed.rows
      .map((row) => {
        const get = (key: ContactFieldKey) => {
          const col = mapping[key];
          if (!col) return "";
          return (row[col] || "").toString().trim();
        };
        const phoneRaw = get("phone");
        const phone = normalizePhone(phoneRaw);
        return {
          name: get("name"),
          phone,
          phoneRaw,
          email: get("email"),
          address: get("address"),
          notes: get("notes"),
        };
      })
      .filter((r) => r.phone || r.name);
  }, [parsed, mapping]);

  const validRows = processedRows.filter((r) => r.name && r.phone && r.phone.length >= 10);
  const invalidRows = processedRows.filter((r) => !r.name || !r.phone || r.phone.length < 10);

  const canProceedToPreview = !!mapping.name && !!mapping.phone && validRows.length > 0;

  async function handleImport() {
    setStep("importing");
    try {
      await onImport(
        validRows.map((r) => ({
          name: r.name || null,
          phone: r.phone,
          email: r.email || null,
          address: r.address || null,
          notes: r.notes || null,
        })),
        strategy,
      );
      handleClose(false);
    } catch {
      setStep("preview");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Contatos
          </DialogTitle>
          <DialogDescription>
            Importe contatos a partir de uma planilha (Excel/CSV) ou arquivo vCard (.vcf).
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <StepBadge active={step === "upload"} done={step !== "upload"} label="1. Arquivo" />
          <span>›</span>
          <StepBadge active={step === "mapping"} done={step === "preview" || step === "importing"} label="2. Mapeamento" />
          <span>›</span>
          <StepBadge active={step === "preview" || step === "importing"} done={false} label="3. Confirmação" />
        </div>

        {/* STEP: UPLOAD */}
        {step === "upload" && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-muted/40 transition"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
            >
              {parsing ? (
                <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
              ) : (
                <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
              )}
              <p className="mt-3 font-medium">Arraste um arquivo aqui ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground mt-1">
                Formatos aceitos: .xlsx, .xls, .csv, .vcf
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv,.vcf,.vcard"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <span>Não tem uma planilha? Baixe nosso modelo padrão.</span>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Modelo
              </Button>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Campos obrigatórios: <strong>nome</strong> e <strong>telefone</strong></p>
              <p>• Campos opcionais: e-mail, endereço, anotações</p>
              <p>• Telefones brasileiros são normalizados automaticamente (com DDD + 9)</p>
            </div>
          </div>
        )}

        {/* STEP: MAPPING */}
        {step === "mapping" && parsed && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 px-4 py-2 flex items-center gap-2 text-sm">
              {parsed.source === "vcard" ? (
                <FileText className="h-4 w-4 text-primary" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 text-primary" />
              )}
              <span className="truncate flex-1">{file?.name}</span>
              <Badge variant="secondary">{parsed.rows.length} linhas</Badge>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Mapeamento de campos</p>
              <p className="text-xs text-muted-foreground mb-3">
                Selecione qual coluna do arquivo corresponde a cada campo do contato.
              </p>
              <div className="space-y-3">
                {CONTACT_FIELDS.map((f) => (
                  <div key={f.key} className="grid grid-cols-[140px_1fr] items-center gap-3">
                    <Label className="text-sm">
                      {f.label}
                      {f.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <Select
                      value={mapping[f.key] ?? NONE}
                      onValueChange={(v) =>
                        setMapping((m) => ({ ...m, [f.key]: v === NONE ? null : v }))
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="— ignorar —" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>— ignorar —</SelectItem>
                        {parsed.headers.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {!canProceedToPreview && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300/50 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Selecione as colunas para <strong>Nome</strong> e <strong>Telefone</strong> e
                  garanta que existem linhas válidas.
                </span>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep("upload")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <Button onClick={() => setStep("preview")} disabled={!canProceedToPreview}>
                Continuar ({validRows.length} válidos)
              </Button>
            </div>
          </div>
        )}

        {/* STEP: PREVIEW */}
        {(step === "preview" || step === "importing") && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <StatCard label="Válidos" value={validRows.length} tone="success" />
              <StatCard label="Inválidos" value={invalidRows.length} tone="warning" />
              <StatCard label="Total" value={processedRows.length} tone="muted" />
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Em caso de telefone duplicado</p>
              <RadioGroup
                value={strategy}
                onValueChange={(v) => setStrategy(v as DuplicateStrategy)}
                disabled={step === "importing"}
                className="grid gap-2"
              >
                <StrategyOption
                  value="merge"
                  label="Mesclar (preencher só o vazio)"
                  desc="Mantém os dados atuais e completa apenas os campos vazios."
                  current={strategy}
                />
                <StrategyOption
                  value="update"
                  label="Atualizar dados existentes"
                  desc="Sobrescreve nome, e-mail e endereço com os da planilha."
                  current={strategy}
                />
                <StrategyOption
                  value="skip"
                  label="Pular duplicados"
                  desc="Ignora telefones já cadastrados, importa apenas os novos."
                  current={strategy}
                />
              </RadioGroup>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Pré-visualização</p>
              <div className="rounded-lg border max-h-64 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 sticky top-0">
                    <tr className="text-left">
                      <th className="px-2 py-1.5 font-medium">Nome</th>
                      <th className="px-2 py-1.5 font-medium">Telefone</th>
                      <th className="px-2 py-1.5 font-medium">E-mail</th>
                      <th className="px-2 py-1.5 font-medium">Endereço</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processedRows.slice(0, 50).map((r, i) => {
                      const valid = r.name && r.phone && r.phone.length >= 10;
                      return (
                        <tr key={i} className={`border-t ${valid ? "" : "bg-destructive/5"}`}>
                          <td className="px-2 py-1 truncate max-w-[140px]">{r.name || "—"}</td>
                          <td className="px-2 py-1 font-mono text-[11px]">{r.phone || r.phoneRaw || "—"}</td>
                          <td className="px-2 py-1 truncate max-w-[160px]">{r.email || "—"}</td>
                          <td className="px-2 py-1 truncate max-w-[160px]">{r.address || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {processedRows.length > 50 && (
                  <p className="text-[11px] text-muted-foreground p-2 text-center border-t">
                    Mostrando 50 de {processedRows.length} linhas
                  </p>
                )}
              </div>
            </div>

            {step === "importing" && (
              <div className="space-y-2">
                <Progress value={66} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  Importando contatos...
                </p>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button
                variant="ghost"
                onClick={() => setStep("mapping")}
                disabled={step === "importing" || isPending}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <Button
                onClick={handleImport}
                disabled={validRows.length === 0 || step === "importing" || isPending}
              >
                {(step === "importing" || isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Importar {validRows.length} contato{validRows.length !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StepBadge({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
        active
          ? "bg-primary text-primary-foreground"
          : done
            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
            : "bg-muted"
      }`}
    >
      {done && <CheckCircle2 className="h-3 w-3" />}
      {label}
    </span>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "muted";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : tone === "warning"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"
        : "border-border bg-muted/40 text-foreground";
  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <p className="text-xs opacity-80">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}

function StrategyOption({
  value,
  label,
  desc,
  current,
}: {
  value: DuplicateStrategy;
  label: string;
  desc: string;
  current: DuplicateStrategy;
}) {
  const checked = current === value;
  return (
    <label
      className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition ${
        checked ? "border-primary bg-primary/5" : "hover:bg-muted/40"
      }`}
    >
      <RadioGroupItem value={value} className="mt-0.5" />
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </label>
  );
}