import { useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Upload, Trash2, FileText, Image as ImageIcon, BookOpen, ExternalLink } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useCatalogs, type Catalog } from "@/hooks/useCatalogs";

export function CatalogsTab() {
  const { catalogsQ, createCatalog, updateCatalog, deleteCatalog } = useCatalogs();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [keywords, setKeywords] = useState("");
  const [caption, setCaption] = useState("");

  const handleUpload = async () => {
    if (!file || !name.trim()) return;
    await createCatalog.mutateAsync({
      file,
      name,
      description,
      caption,
      keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
    });
    setFile(null);
    setName("");
    setDescription("");
    setKeywords("");
    setCaption("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const items = (catalogsQ.data ?? []) as Catalog[];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" /> Catálogos
          </CardTitle>
          <CardDescription>
            Envie catálogos em imagem (JPG/PNG) ou PDF. Quando o cliente pedir o catálogo no
            WhatsApp, a IA envia o arquivo automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome do catálogo</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Catálogo de Produtos 2026" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Palavras-chave (separadas por vírgula)</Label>
              <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="catálogo, tabela de preços, produtos" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Descrição (ajuda a IA a escolher o catálogo certo)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[70px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Legenda enviada junto com o arquivo (opcional)</Label>
            <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Segue nosso catálogo completo 😊" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Arquivo (imagem ou PDF, até 16MB)</Label>
            <Input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button className="gap-2" disabled={!file || !name.trim() || createCatalog.isPending} onClick={handleUpload}>
            {createCatalog.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {createCatalog.isPending ? "Enviando..." : "Adicionar catálogo"}
          </Button>
        </CardContent>
      </Card>

      {catalogsQ.isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Nenhum catálogo cadastrado ainda.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      {c.file_type === "image" ? <ImageIcon className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-primary" />}
                      <span className="font-medium truncate">{c.name}</span>
                      {!c.enabled && <Badge variant="secondary" className="text-xs">Desativado</Badge>}
                    </div>
                    {c.description && <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>}
                    <div className="flex flex-wrap gap-1">
                      {(c.keywords || []).map((k) => (
                        <Badge key={k} variant="outline" className="text-[10px]">{k}</Badge>
                      ))}
                    </div>
                  </div>
                  <Switch
                    checked={c.enabled}
                    onCheckedChange={(enabled) => updateCatalog.mutate({ id: c.id, patch: { enabled } })}
                  />
                </div>

                {c.file_type === "image" && (
                  <img src={c.file_url} alt={c.name} className="w-full max-h-48 object-contain rounded border bg-muted" />
                )}

                <div className="flex items-center justify-between gap-2">
                  <Button variant="outline" size="sm" className="gap-2" asChild>
                    <a href={c.file_url} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" /> Abrir arquivo
                    </a>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="gap-2 text-destructive">
                        <Trash2 className="h-4 w-4" /> Remover
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover catálogo?</AlertDialogTitle>
                        <AlertDialogDescription>
                          O arquivo "{c.name}" será excluído e a IA não poderá mais enviá-lo.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteCatalog.mutate(c)}>Remover</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
