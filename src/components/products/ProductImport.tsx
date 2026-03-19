import { useState, useRef } from "react";
import Papa from "papaparse";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Upload } from "lucide-react";

interface ImportRow {
  name: string;
  description?: string;
  quantity?: number;
  price_cents?: number;
  sku?: string;
}

interface ProductImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (rows: ImportRow[]) => void;
}

const COLUMN_MAP: Record<string, keyof ImportRow> = {
  nome: "name", name: "name", produto: "name", product: "name",
  descrição: "description", descricao: "description", description: "description",
  quantidade: "quantity", qty: "quantity", quantity: "quantity", estoque: "quantity",
  valor: "price_cents", preço: "price_cents", preco: "price_cents", price: "price_cents",
  sku: "sku", código: "sku", codigo: "sku", code: "sku",
};

function mapColumns(headers: string[]): Record<number, keyof ImportRow> {
  const mapping: Record<number, keyof ImportRow> = {};
  headers.forEach((h, i) => {
    const key = h.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const mapped = COLUMN_MAP[key];
    if (mapped) mapping[i] = mapped;
  });
  return mapping;
}

export function ProductImport({ open, onOpenChange, onImport }: ProductImportProps) {
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setError("");
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (result) => {
        const rows = result.data as string[][];
        if (rows.length < 2) { setError("Arquivo vazio ou sem dados"); return; }
        const colMap = mapColumns(rows[0]);
        if (!Object.values(colMap).includes("name")) { setError("Coluna 'Nome' não encontrada. Use: nome, descrição, quantidade, valor, sku"); return; }

        const mapped: ImportRow[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const item: any = {};
          Object.entries(colMap).forEach(([idx, key]) => {
            const val = row[parseInt(idx)]?.trim();
            if (!val) return;
            if (key === "quantity") item[key] = parseInt(val) || 0;
            else if (key === "price_cents") {
              const num = parseFloat(val.replace(",", "."));
              item[key] = isNaN(num) ? 0 : Math.round(num * 100);
            } else item[key] = val;
          });
          if (item.name) mapped.push(item);
        }
        if (mapped.length === 0) { setError("Nenhum produto válido encontrado"); return; }
        setPreview(mapped);
      },
      error: () => setError("Erro ao ler arquivo CSV"),
    });
  };

  const handleConfirm = () => {
    onImport(preview);
    setPreview([]);
    onOpenChange(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) { setPreview([]); setError(""); }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Produtos via CSV</DialogTitle>
        </DialogHeader>

        {preview.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Envie um arquivo CSV com as colunas: <strong>nome</strong>, descrição, quantidade, valor, sku.
              A primeira linha deve conter os cabeçalhos.
            </p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
            <Button variant="outline" className="w-full h-24 border-dashed" onClick={() => fileRef.current?.click()}>
              <Upload className="h-5 w-5 mr-2" /> Selecionar arquivo CSV
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{preview.length} produtos encontrados. Confira os dados antes de importar:</p>
            <div className="max-h-[400px] overflow-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>SKU</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.slice(0, 50).map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{p.description || "—"}</TableCell>
                      <TableCell className="text-right">{p.quantity ?? 0}</TableCell>
                      <TableCell className="text-right">R$ {((p.price_cents || 0) / 100).toFixed(2)}</TableCell>
                      <TableCell>{p.sku || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {preview.length > 50 && <p className="text-xs text-muted-foreground">Exibindo 50 de {preview.length} produtos</p>}
          </div>
        )}

        <DialogFooter className="gap-2">
          {preview.length > 0 && (
            <>
              <Button variant="outline" onClick={() => setPreview([])}>Voltar</Button>
              <Button onClick={handleConfirm}>Importar {preview.length} produtos</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
