import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Trash2,
  Pencil,
  ArrowLeft,
  FileText,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  useAdminHelpArticle,
  useAdminHelpArticles,
  useAdminHelpCategories,
  useDeleteHelpArticle,
  useDeleteHelpCategory,
  useUpsertHelpArticle,
  useUpsertHelpCategory,
} from "@/hooks/useHelpAdmin";
import type { HelpArticle, HelpCategory } from "@/hooks/useHelpCenter";
import { RichTextEditor } from "@/components/help/RichTextEditor";
import { HelpImageUploader } from "@/components/help/HelpImageUploader";

type View =
  | { kind: "categories" }
  | { kind: "articles"; category: HelpCategory }
  | { kind: "editor"; category: HelpCategory; articleId: string | null };

export default function AdminHelpCenter() {
  const [view, setView] = useState<View>({ kind: "categories" });

  return (
    <AdminLayout title="Central de Ajuda" description="Gerencie tutoriais, categorias e prints">
      {view.kind === "categories" && <CategoriesView onOpen={(c) => setView({ kind: "articles", category: c })} />}
      {view.kind === "articles" && (
        <ArticlesView
          category={view.category}
          onBack={() => setView({ kind: "categories" })}
          onEdit={(id) => setView({ kind: "editor", category: view.category, articleId: id })}
        />
      )}
      {view.kind === "editor" && (
        <ArticleEditor
          category={view.category}
          articleId={view.articleId}
          onBack={() => setView({ kind: "articles", category: view.category })}
        />
      )}
    </AdminLayout>
  );
}

/* =========== Categorias =========== */

function CategoriesView({ onOpen }: { onOpen: (c: HelpCategory) => void }) {
  const { data, isLoading } = useAdminHelpCategories();
  const upsert = useUpsertHelpCategory();
  const remove = useDeleteHelpCategory();
  const [editing, setEditing] = useState<HelpCategory | null>(null);
  const [open, setOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState<HelpCategory | null>(null);

  const startCreate = () => {
    setEditing(null);
    setOpen(true);
  };
  const startEdit = (c: HelpCategory) => {
    setEditing(c);
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{data?.length ?? 0} categorias</p>
        <Button onClick={startCreate} className="bg-amber-500 hover:bg-amber-600 text-slate-950">
          <Plus className="h-4 w-4 mr-1" />
          Nova categoria
        </Button>
      </div>

      {isLoading ? (
        <div className="text-slate-500">Carregando...</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data?.map((c) => (
            <Card key={c.id} className="p-4 bg-slate-900/40 border-slate-800">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onOpen(c)}>
                  <h3 className="font-semibold text-slate-100 truncate">{c.name}</h3>
                  <p className="text-xs text-slate-500 truncate">/{c.slug}</p>
                  {c.description && (
                    <p className="text-sm text-slate-400 mt-1 line-clamp-2">{c.description}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(c)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-destructive"
                    onClick={() => setConfirmDel(c)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 w-full"
                onClick={() => onOpen(c)}
              >
                <FileText className="h-3.5 w-3.5 mr-1" />
                Ver artigos
              </Button>
            </Card>
          ))}
        </div>
      )}

      <CategoryDialog
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        onSubmit={async (payload) => {
          await upsert.mutateAsync(payload);
          setOpen(false);
        }}
      />

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os artigos e imagens dentro de "{confirmDel?.name}" serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => {
                if (confirmDel) remove.mutate(confirmDel.id);
                setConfirmDel(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CategoryDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: HelpCategory | null;
  onSubmit: (payload: Partial<HelpCategory> & { name: string }) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("BookOpen");
  const [position, setPosition] = useState(0);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setDescription(initial?.description ?? "");
      setIcon(initial?.icon ?? "BookOpen");
      setPosition(initial?.position ?? 0);
    }
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar categoria" : "Nova categoria"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Ícone (Lucide)</Label>
              <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="BookOpen" />
              <p className="text-xs text-muted-foreground mt-1">
                Ex: Smartphone, Bot, Calendar, Users
              </p>
            </div>
            <div>
              <Label>Posição</Label>
              <Input
                type="number"
                value={position}
                onChange={(e) => setPosition(parseInt(e.target.value || "0", 10))}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() =>
              onSubmit({
                id: initial?.id,
                name,
                description: description || null,
                icon: icon || "BookOpen",
                position,
              })
            }
            disabled={!name.trim()}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* =========== Artigos =========== */

function ArticlesView({
  category,
  onBack,
  onEdit,
}: {
  category: HelpCategory;
  onBack: () => void;
  onEdit: (id: string | null) => void;
}) {
  const { data, isLoading } = useAdminHelpArticles(category.id);
  const remove = useDeleteHelpArticle();
  const [confirmDel, setConfirmDel] = useState<HelpArticle | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-400">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Categorias
        </Button>
        <Button onClick={() => onEdit(null)} className="bg-amber-500 hover:bg-amber-600 text-slate-950">
          <Plus className="h-4 w-4 mr-1" />
          Novo artigo
        </Button>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-white">{category.name}</h2>
        <p className="text-xs text-slate-500">{data?.length ?? 0} artigos</p>
      </div>

      {isLoading ? (
        <div className="text-slate-500">Carregando...</div>
      ) : (
        <div className="space-y-2">
          {data?.map((a) => (
            <Card key={a.id} className="p-3 bg-slate-900/40 border-slate-800">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-slate-100">{a.title}</h3>
                    {a.published ? (
                      <Badge variant="outline" className="text-emerald-400 border-emerald-500/40">
                        <Eye className="h-3 w-3 mr-1" />
                        Publicado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-slate-500 border-slate-700">
                        <EyeOff className="h-3 w-3 mr-1" />
                        Rascunho
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">/{a.slug}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => onEdit(a.id)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => setConfirmDel(a)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover artigo?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDel?.title}" e todas as imagens vinculadas serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => {
                if (confirmDel) remove.mutate(confirmDel.id);
                setConfirmDel(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* =========== Editor de artigo =========== */

function ArticleEditor({
  category,
  articleId,
  onBack,
}: {
  category: HelpCategory;
  articleId: string | null;
  onBack: () => void;
}) {
  const { data } = useAdminHelpArticle(articleId);
  const upsert = useUpsertHelpArticle();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [position, setPosition] = useState(0);
  const [published, setPublished] = useState(true);
  const [savedId, setSavedId] = useState<string | null>(articleId);

  useEffect(() => {
    if (data?.article) {
      setTitle(data.article.title);
      setSlug(data.article.slug);
      setSummary(data.article.summary ?? "");
      setContent(data.article.content ?? "");
      setPosition(data.article.position);
      setPublished(data.article.published);
      setSavedId(data.article.id);
    } else if (!articleId) {
      setTitle("");
      setSlug("");
      setSummary("");
      setContent("");
      setPosition(0);
      setPublished(true);
      setSavedId(null);
    }
  }, [data, articleId]);

  const handleSave = async () => {
    const result = await upsert.mutateAsync({
      id: savedId ?? undefined,
      category_id: category.id,
      title,
      slug: slug || undefined,
      summary: summary || null,
      content,
      position,
      published,
    });
    if (result?.id) setSavedId(result.id);
  };

  const images = data?.images ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-400">
          <ArrowLeft className="h-4 w-4 mr-1" />
          {category.name}
        </Button>
        <Button onClick={handleSave} disabled={!title.trim() || upsert.isPending} className="bg-amber-500 hover:bg-amber-600 text-slate-950">
          {upsert.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      <Card className="p-4 bg-slate-900/40 border-slate-800 space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Slug (URL)</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="gerado automaticamente"
            />
          </div>
        </div>
        <div>
          <Label>Resumo curto</Label>
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Aparece na lista de artigos. 1 a 2 linhas."
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Switch checked={published} onCheckedChange={setPublished} id="pub" />
            <Label htmlFor="pub" className="cursor-pointer">
              {published ? "Publicado (visível para usuários)" : "Rascunho (oculto)"}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Posição</Label>
            <Input
              type="number"
              value={position}
              onChange={(e) => setPosition(parseInt(e.target.value || "0", 10))}
              className="w-20"
            />
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-slate-900/40 border-slate-800 space-y-2">
        <Label>Conteúdo do tutorial</Label>
        <p className="text-xs text-slate-500">
          Use marcadores como <code className="bg-slate-800 px-1 rounded">[PRINT 1]</code>, <code className="bg-slate-800 px-1 rounded">[PRINT 2]</code>... no texto. Eles serão substituídos pelas imagens da galeria abaixo na ordem cadastrada.
        </p>
        <RichTextEditor value={content} onChange={setContent} />
      </Card>

      <Card className="p-4 bg-slate-900/40 border-slate-800 space-y-3">
        <div>
          <h3 className="font-semibold text-white">Prints / Imagens</h3>
          <p className="text-xs text-slate-500">
            A imagem #1 aparece onde estiver <code className="bg-slate-800 px-1 rounded">[PRINT 1]</code>, a #2 onde estiver <code className="bg-slate-800 px-1 rounded">[PRINT 2]</code>, e assim por diante.
          </p>
        </div>
        {savedId ? (
          <HelpImageUploader articleId={savedId} images={images} />
        ) : (
          <div className="text-sm text-slate-400 bg-slate-800/40 rounded p-3">
            Salve o artigo primeiro para começar a subir imagens.
          </div>
        )}
      </Card>
    </div>
  );
}