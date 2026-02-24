import { useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useKnowledgeBase } from "@/hooks/useKnowledgeBase";
import { FileText, Upload, Trash2, Loader2, File, CheckCircle2, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function KnowledgeBase() {
  const { documents, isLoading, uploadDocument, deleteDocument } = useKnowledgeBase();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadDocument.mutate(file);
      e.target.value = "";
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "N/A";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return <Badge className="bg-accent text-accent-foreground"><CheckCircle2 className="mr-1 h-3 w-3" /> Pronto</Badge>;
      case "processing":
        return <Badge variant="outline"><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Processando</Badge>;
      case "error":
        return <Badge variant="destructive"><AlertCircle className="mr-1 h-3 w-3" /> Erro</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout 
      title="Base de Conhecimento" 
      description="Carregue documentos para o agente IA usar nas respostas"
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documentos
          </CardTitle>
          <CardDescription>
            Faça upload de PDFs, documentos Word ou arquivos de texto com informações sobre sua empresa
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Upload Area */}
          <div 
            className="mb-6 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 transition-colors hover:border-primary/50"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mb-4 h-10 w-10 text-muted-foreground" />
            <p className="mb-1 font-medium">Clique para fazer upload</p>
            <p className="text-sm text-muted-foreground">PDF, DOCX, TXT (máx. 10MB)</p>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.docx,.doc,.txt"
              onChange={handleFileChange}
              disabled={uploadDocument.isPending}
            />
          </div>

          {uploadDocument.isPending && (
            <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Enviando documento...
            </div>
          )}

          {/* Document List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : documents.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <File className="mx-auto h-12 w-12 opacity-30" />
              <p className="mt-4">Nenhum documento carregado</p>
              <p className="text-sm">Faça upload de documentos para treinar seu agente IA</p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div 
                  key={doc.id} 
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-medium">{doc.file_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(doc.file_size)} • {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(doc.status)}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteDocument.mutate(doc.id)}
                      disabled={deleteDocument.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
