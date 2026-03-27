import { useState, useEffect, useRef } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTutorialVideos } from "@/hooks/useTutorialVideos";
import { Video, Save, Loader2, Trash2, Upload, Link, FileVideo } from "lucide-react";

const ONBOARDING_STEPS = [
  { key: "welcome", label: "Boas-vindas" },
  { key: "whatsapp", label: "Conectar WhatsApp" },
  { key: "appointments", label: "Agendamentos" },
  { key: "interview", label: "Entrevista IA" },
  { key: "location_question", label: "Pergunta Local de Atendimento" },
  { key: "location", label: "Endereço / Localização" },
  { key: "test_prompt", label: "Testar Prompt" },
];

export default function AdminTutorialVideos() {
  const { videos, isLoading, upsertVideo, uploadVideo, deleteVideo } = useTutorialVideos();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    const map: Record<string, string> = {};
    videos.forEach((v) => {
      if (v.video_url) map[v.step_key] = v.video_url;
    });
    setUrls(map);
  }, [videos]);

  const handleSaveUrl = (stepKey: string) => {
    const url = urls[stepKey]?.trim() || null;
    upsertVideo.mutate({ step_key: stepKey, video_url: url, file_path: null });
  };

  const handleUpload = (stepKey: string, file: File) => {
    uploadVideo.mutate({ step_key: stepKey, file });
  };

  const handleClear = (stepKey: string) => {
    setUrls((prev) => ({ ...prev, [stepKey]: "" }));
    deleteVideo.mutate(stepKey);
  };

  const getYouTubeEmbedUrl = (url: string): string | null => {
    if (!url) return null;
    const match = url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  };

  const isPending = upsertVideo.isPending || uploadVideo.isPending || deleteVideo.isPending;

  return (
    <AdminLayout title="Vídeos Tutoriais" description="Gerencie os vídeos exibidos em cada etapa do onboarding">
      <div className="max-w-3xl space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          ONBOARDING_STEPS.map((step) => {
            const currentUrl = urls[step.key] || "";
            const embedUrl = getYouTubeEmbedUrl(currentUrl);
            const existingVideo = videos.find((v) => v.step_key === step.key);
            const hasFile = !!existingVideo?.file_path;
            const hasYoutube = !!existingVideo?.video_url;
            const hasChanged = (existingVideo?.video_url || "") !== currentUrl;

            return (
              <Card key={step.key} className="bg-slate-900/50 border-slate-800">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-white text-sm">
                    <span className="flex items-center gap-2">
                      <Video className="h-4 w-4 text-amber-400" />
                      {step.label}
                    </span>
                    {(hasFile || hasYoutube) && (
                      <span className="flex items-center gap-1 text-xs font-normal text-emerald-400">
                        <FileVideo className="h-3 w-3" />
                        {hasFile ? "Vídeo anexado" : "YouTube"}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Tabs defaultValue={hasFile ? "upload" : "link"} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-slate-800">
                      <TabsTrigger value="link" className="text-xs gap-1">
                        <Link className="h-3 w-3" /> Link YouTube
                      </TabsTrigger>
                      <TabsTrigger value="upload" className="text-xs gap-1">
                        <Upload className="h-3 w-3" /> Anexar Vídeo
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="link" className="space-y-3 mt-3">
                      <div className="flex gap-2">
                        <Input
                          value={currentUrl}
                          onChange={(e) =>
                            setUrls((prev) => ({ ...prev, [step.key]: e.target.value }))
                          }
                          placeholder="https://www.youtube.com/watch?v=..."
                          className="bg-slate-800 border-slate-700 text-slate-200 text-sm"
                        />
                        <Button
                          onClick={() => handleSaveUrl(step.key)}
                          disabled={isPending || !hasChanged}
                          size="icon"
                          className="bg-amber-500 hover:bg-amber-600 text-black shrink-0"
                        >
                          {upsertVideo.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {embedUrl && (
                        <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-slate-800 border border-slate-700">
                          <iframe
                            src={embedUrl}
                            title={`Tutorial - ${step.label}`}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="absolute inset-0 w-full h-full"
                          />
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="upload" className="space-y-3 mt-3">
                      <input
                        ref={(el) => { fileInputRefs.current[step.key] = el; }}
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUpload(step.key, file);
                          e.target.value = "";
                        }}
                      />
                      <Button
                        variant="outline"
                        className="w-full border-dashed border-slate-600 text-slate-300 hover:bg-slate-800 gap-2"
                        onClick={() => fileInputRefs.current[step.key]?.click()}
                        disabled={isPending}
                      >
                        {uploadVideo.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        {uploadVideo.isPending ? "Enviando..." : "Selecionar arquivo de vídeo"}
                      </Button>

                      {hasFile && (
                        <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-slate-800 border border-slate-700">
                          <video
                            src={existingVideo!.file_path!}
                            controls
                            className="absolute inset-0 w-full h-full object-contain"
                          />
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>

                  {(hasFile || hasYoutube) && (
                    <Button
                      onClick={() => handleClear(step.key)}
                      disabled={isPending}
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300 hover:bg-red-950/30 gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remover vídeo
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </AdminLayout>
  );
}
