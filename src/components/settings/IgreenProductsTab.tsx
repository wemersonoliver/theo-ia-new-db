import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, Package, Save, Trash2, BookOpen, Video, Upload, X } from "lucide-react";
import { useIgreenAccountProducts, type IgreenAccountProduct } from "@/hooks/useIgreenAccountProducts";
import { KnowledgeBaseTab } from "./KnowledgeBaseTab";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function IgreenProductsTab() {
  const { productsQ, createProduct, updateProduct, deleteProduct } = useIgreenAccountProducts();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const handleCreate = () => {
    if (!name.trim()) return;
    createProduct.mutate(
      { name, description: desc },
      {
        onSuccess: () => {
          setName("");
          setDesc("");
          setOpen(false);
        },
      },
    );
  };

  if (productsQ.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const products = productsQ.data ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" /> Produtos Igreen
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Cadastre os produtos que sua operação vende. Cada produto pode ter sua própria
          base de conhecimento e estará disponível na aba de Follow-Up para a criação de
          cenários específicos.
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Novo produto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo produto</DialogTitle>
              <DialogDescription>
                Cadastre um novo produto. Você poderá adicionar a base de conhecimento depois.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label className="text-xs">Nome do produto</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ex: Conexão Premium"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Descrição</Label>
                <Textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="O que é este produto?"
                  className="min-h-[80px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!name.trim() || createProduct.isPending}
                className="gap-2"
              >
                <Plus className="h-4 w-4" /> Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {products.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-6 border rounded-lg">
          Nenhum produto cadastrado. Clique em "Novo produto" para começar.
        </div>
      ) : (
        <Accordion type="single" collapsible className="space-y-3">
          {products.map((p) => (
            <ProductRow
              key={p.id}
              product={p}
              onToggle={(enabled) => updateProduct.mutate({ id: p.id, patch: { enabled } })}
              onSave={(patch) => updateProduct.mutate({ id: p.id, patch })}
              onDelete={() => deleteProduct.mutate(p.id)}
              saving={updateProduct.isPending}
            />
          ))}
        </Accordion>
      )}
    </div>
  );
}

function ProductRow({
  product,
  onToggle,
  onSave,
  onDelete,
  saving,
}: {
  product: IgreenAccountProduct;
  onToggle: (enabled: boolean) => void;
  onSave: (patch: Partial<IgreenAccountProduct>) => void;
  onDelete: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? "");
  const [uploading, setUploading] = useState(false);
  const videoUrl = (product as any).video_url as string | null | undefined;

  useEffect(() => {
    setName(product.name);
    setDescription(product.description ?? "");
  }, [product.name, product.description]);

  const handleUpload = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast.error("Selecione um arquivo de vídeo.");
      return;
    }
    const maxBytes = 16 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error("Vídeo muito grande. Limite: 16MB (WhatsApp).");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
      const path = `igreen-products/${product.account_id}/${product.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("whatsapp-media")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("whatsapp-media").getPublicUrl(path);
      onSave({ video_url: pub.publicUrl } as Partial<IgreenAccountProduct>);
      toast.success("Vídeo enviado");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar vídeo");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveVideo = () => {
    onSave({ video_url: null } as Partial<IgreenAccountProduct>);
  };

  return (
    <AccordionItem value={product.id} className="rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-3 px-4">
        <AccordionTrigger className="flex-1 hover:no-underline py-3">
          <div className="flex flex-col items-start gap-1 w-full">
            <div className="flex items-center gap-3 flex-wrap">
              <Package className="h-4 w-4 text-primary" />
              <span className="font-medium">{product.name}</span>
              <Badge variant="outline" className="font-mono text-xs">{product.key}</Badge>
              {!product.enabled && <Badge variant="secondary" className="text-xs">Desativado</Badge>}
            </div>
            {product.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 max-w-full pr-4">
                {product.description}
              </p>
            )}
          </div>
        </AccordionTrigger>
        <Switch
          checked={product.enabled}
          onCheckedChange={onToggle}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      <AccordionContent className="px-4 pb-4 space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Dados do produto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descrição</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs flex items-center gap-2">
                <Video className="h-3.5 w-3.5" /> Vídeo de apresentação
              </Label>
              <p className="text-xs text-muted-foreground">
                Envie um arquivo de vídeo (até 16MB). Será enviado pelo WhatsApp como vídeo nativo, não como link.
              </p>
              {videoUrl ? (
                <div className="space-y-2">
                  <video src={videoUrl} controls className="w-full max-w-sm rounded border" />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={uploading}
                      onClick={() => document.getElementById(`video-${product.id}`)?.click()}
                    >
                      <Upload className="h-4 w-4" /> Substituir vídeo
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 text-destructive"
                      disabled={uploading}
                      onClick={handleRemoveVideo}
                    >
                      <X className="h-4 w-4" /> Remover
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={uploading}
                  onClick={() => document.getElementById(`video-${product.id}`)?.click()}
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? "Enviando..." : "Enviar vídeo"}
                </Button>
              )}
              <input
                id={`video-${product.id}`}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="flex justify-between gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-2">
                    <Trash2 className="h-4 w-4" /> Excluir produto
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação remove o produto "{product.name}". Documentos vinculados
                      permanecerão na base, mas sem produto associado. Não é possível excluir
                      se houver cenários de follow-up vinculados.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete}>Excluir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button
                size="sm"
                className="gap-2"
                disabled={saving}
                onClick={() =>
                  onSave({
                    name: name.trim() || product.name,
                    description: description.trim() ? description.trim() : null,
                  })
                }
              >
                <Save className="h-4 w-4" /> Salvar
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <BookOpen className="h-4 w-4 text-primary" />
            Base de conhecimento do produto
          </div>
          <KnowledgeBaseTab
            productId={product.id}
            title={`Documentos — ${product.name}`}
            description="Documentos exclusivos deste produto, usados pelo agente de IA quando o assunto for este produto."
          />
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}