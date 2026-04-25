import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { getHelpImageUrl, type HelpArticleImage } from "@/hooks/useHelpCenter";
import {
  useDeleteArticleImage,
  useUpdateArticleImage,
  useUploadArticleImage,
} from "@/hooks/useHelpAdmin";

interface HelpImageUploaderProps {
  articleId: string;
  images: HelpArticleImage[];
}

export function HelpImageUploader({ articleId, images }: HelpImageUploaderProps) {
  const upload = useUploadArticleImage();
  const update = useUpdateArticleImage();
  const remove = useDeleteArticleImage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [draftCaptions, setDraftCaptions] = useState<Record<string, string>>({});

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const startPos = images.length;
    let i = 0;
    for (const f of Array.from(files)) {
      await upload.mutateAsync({ articleId, file: f, position: startPos + i });
      i++;
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      <div
        className="rounded-lg border-2 border-dashed p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
      >
        <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">Clique ou arraste imagens (prints) aqui</p>
        <p className="text-xs text-muted-foreground">PNG, JPG, WEBP — múltiplas por vez</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {images.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-4">
          <ImagePlus className="mx-auto h-6 w-6 mb-2 opacity-60" />
          Nenhuma imagem ainda. Faça upload dos prints para este artigo.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {images.map((img, idx) => (
            <div key={img.id} className="rounded-lg border overflow-hidden bg-card">
              <img
                src={getHelpImageUrl(img.storage_path)}
                alt={img.caption ?? `Print ${idx + 1}`}
                className="w-full aspect-video object-cover bg-muted"
              />
              <div className="p-2 space-y-2">
                <Input
                  placeholder="Legenda (opcional)"
                  defaultValue={img.caption ?? ""}
                  onChange={(e) =>
                    setDraftCaptions((d) => ({ ...d, [img.id]: e.target.value }))
                  }
                  onBlur={() => {
                    const v = draftCaptions[img.id];
                    if (v !== undefined && v !== (img.caption ?? "")) {
                      update.mutate({ id: img.id, caption: v });
                    }
                  }}
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Print #{idx + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => remove.mutate({ id: img.id, path: img.storage_path })}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}