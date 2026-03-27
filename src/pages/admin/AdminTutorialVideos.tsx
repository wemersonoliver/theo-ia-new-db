import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useTutorialVideos } from "@/hooks/useTutorialVideos";
import { Video, Save, Loader2, Trash2 } from "lucide-react";

const ONBOARDING_STEPS = [
  { key: "welcome", label: "Boas-vindas" },
  { key: "whatsapp", label: "Conectar WhatsApp" },
  { key: "appointments_question", label: "Pergunta Agendamentos" },
  { key: "appointments_config", label: "Configurar Agendamentos" },
  { key: "interview", label: "Entrevista IA" },
  { key: "location_question", label: "Pergunta Local de Atendimento" },
  { key: "location", label: "Endereço / Localização" },
  { key: "test_prompt", label: "Testar Prompt" },
];

export default function AdminTutorialVideos() {
  const { videos, isLoading, upsertVideo } = useTutorialVideos();
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const map: Record<string, string> = {};
    videos.forEach((v) => {
      if (v.video_url) map[v.step_key] = v.video_url;
    });
    setUrls(map);
  }, [videos]);

  const handleSave = (stepKey: string) => {
    const url = urls[stepKey]?.trim() || null;
    upsertVideo.mutate({ step_key: stepKey, video_url: url });
  };

  const handleClear = (stepKey: string) => {
    setUrls((prev) => ({ ...prev, [stepKey]: "" }));
    upsertVideo.mutate({ step_key: stepKey, video_url: null });
  };

  const getYouTubeEmbedUrl = (url: string): string | null => {
    if (!url) return null;
    const match = url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  };

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
            const hasChanged = (existingVideo?.video_url || "") !== currentUrl;

            return (
              <Card key={step.key} className="bg-slate-900/50 border-slate-800">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-white text-sm">
                    <Video className="h-4 w-4 text-amber-400" />
                    {step.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-slate-300 text-xs">Link do YouTube</Label>
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
                        onClick={() => handleSave(step.key)}
                        disabled={upsertVideo.isPending || !hasChanged}
                        size="icon"
                        className="bg-amber-500 hover:bg-amber-600 text-black shrink-0"
                      >
                        {upsertVideo.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                      </Button>
                      {currentUrl && (
                        <Button
                          onClick={() => handleClear(step.key)}
                          disabled={upsertVideo.isPending}
                          size="icon"
                          variant="ghost"
                          className="text-red-400 hover:text-red-300 hover:bg-red-950/30 shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
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
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </AdminLayout>
  );
}
