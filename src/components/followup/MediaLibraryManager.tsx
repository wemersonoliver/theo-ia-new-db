import { useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, Upload, Search, FileText, Image as ImageIcon, Mic, Video, FileType } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFollowupMediaLibrary, type MediaLibraryItem } from "@/hooks/useCustomFollowup";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const TYPE_ICON: Record<string, JSX.Element> = {
  audio: <Mic className="h-4 w-4" />,
  image: <ImageIcon className="h-4 w-4" />,
  video: <Video className="h-4 w-4" />,
  document: <FileType className="h-4 w-4" />,
  sticker: <FileText className="h-4 w-4" />,
};

export function MediaLibraryManager() {
  const { listQuery, addItem, deleteItem } = useFollowupMediaLibrary();
  const fileRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<MediaLibraryItem["type"]>("image");
  const [tagsInput, setTagsInput] = useState("");
  const [search, setSearch] = useState("");

  const onPick = async (file: File) => {
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    await addItem.mutateAsync({ file, tags, type });
    setTagsInput("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const items = (listQuery.data || []).filter((i) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return i.name.toLowerCase().includes(s) || (i.tags || []).some((t) => t.toLowerCase().includes(s));
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Biblioteca de Mídia</CardTitle>
          <CardDescription>
            Reaproveite áudios, imagens, vídeos e documentos em qualquer fluxo personalizado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Select value={type} onValueChange={(v) => setType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="audio">Áudio</SelectItem>
                <SelectItem value="image">Imagem</SelectItem>
                <SelectItem value="video">Vídeo</SelectItem>
                <SelectItem value="document">Documento</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Tags (separadas por vírgula)" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
            <Input
              ref={fileRef}
              type="file"
              accept={type === "audio" ? "audio/*" : type === "video" ? "video/*" : type === "image" ? "image/*" : undefined}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); }}
            />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {addItem.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando…</> : <><Upload className="h-4 w-4" /> Selecione um arquivo</>}
            </div>
          </div>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar por nome ou tag" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {listQuery.isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">Nenhuma mídia encontrada.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {items.map((i) => (
            <Card key={i.id}>
              <CardContent className="p-3 space-y-2">
                <div className="aspect-video bg-muted rounded flex items-center justify-center overflow-hidden">
                  {i.type === "image" ? (
                    <img src={i.url} alt={i.name} className="w-full h-full object-cover" />
                  ) : i.type === "video" ? (
                    <video src={i.url} className="w-full h-full" controls />
                  ) : i.type === "audio" ? (
                    <audio src={i.url} controls className="w-full px-2" />
                  ) : (
                    <div className="text-muted-foreground">{TYPE_ICON[i.type]}</div>
                  )}
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{i.name}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <Badge variant="outline" className="text-[10px]">{i.type}</Badge>
                      {(i.tags || []).slice(0, 4).map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                      ))}
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="text-destructive h-8 w-8"><Trash2 className="h-4 w-4" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover mídia?</AlertDialogTitle>
                        <AlertDialogDescription>O arquivo será removido do storage e não poderá mais ser reutilizado.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteItem.mutate(i)}>Remover</AlertDialogAction>
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