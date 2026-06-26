import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Volume2, Upload, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useIgreenGreetingAudios, GreetingAudioSlot } from "@/hooks/useIgreenGreetingAudios";

const SLOT_DEFAULTS: Record<number, { label: string; delay: number }> = {
  1: { label: "Áudio 1 — enviado imediatamente", delay: 0 },
  2: { label: "Áudio 2 — enviado 10s após o primeiro", delay: 10000 },
};

function SlotCard({
  slot,
  current,
  getSignedUrl,
  onSave,
  saving,
}: {
  slot: number;
  current?: GreetingAudioSlot;
  getSignedUrl: (p: string | null) => Promise<string | null>;
  onSave: (input: { transcript: string; enabled: boolean; file: File | null }) => Promise<void>;
  saving: boolean;
}) {
  const [transcript, setTranscript] = useState(current?.transcript ?? "");
  const [enabled, setEnabled] = useState(current?.enabled ?? true);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    setTranscript(current?.transcript ?? "");
    setEnabled(current?.enabled ?? true);
    let active = true;
    (async () => {
      const url = await getSignedUrl(current?.storage_path ?? null);
      if (active) setPreviewUrl(url);
    })();
    return () => {
      active = false;
    };
  }, [current?.storage_path, current?.transcript, current?.enabled, getSignedUrl]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Volume2 className="h-4 w-4" />
          {SLOT_DEFAULTS[slot].label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {previewUrl ? (
          <audio controls src={previewUrl} className="w-full" />
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum áudio enviado ainda.</p>
        )}

        <div className="space-y-2">
          <Label>Substituir áudio (mp3, ogg, m4a — até 16 MB)</Label>
          <input
            type="file"
            accept="audio/mpeg,audio/mp3,audio/ogg,audio/m4a,audio/mp4,audio/wav,audio/x-m4a"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground"
          />
        </div>

        <div className="space-y-2">
          <Label>Transcrição (a IA usa este texto como contexto no histórico)</Label>
          <Textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={4}
            placeholder="Digite o que está sendo dito no áudio..."
          />
        </div>

        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">Slot ativo</p>
            <p className="text-xs text-muted-foreground">Desligue para parar de enviar apenas este áudio.</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <Button
          onClick={async () => {
            if (transcript.trim().length < 3 && !current?.storage_path && !file) {
              toast.error("Envie um áudio ou escreva uma transcrição antes de salvar.");
              return;
            }
            try {
              await onSave({ transcript, enabled, file });
              setFile(null);
              toast.success(`Áudio ${slot} salvo!`);
            } catch (e) {
              toast.error(`Erro ao salvar: ${e instanceof Error ? e.message : String(e)}`);
            }
          }}
          disabled={saving}
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          Salvar áudio {slot}
        </Button>
      </CardContent>
    </Card>
  );
}

export function IgreenGreetingAudiosTab() {
  const { audios, loading, enabled, setToggle, saveSlot, getSignedUrl } = useIgreenGreetingAudios();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const slot1 = audios.find((a) => a.slot === 1);
  const slot2 = audios.find((a) => a.slot === 2);
  const bothConfigured = !!(slot1?.storage_path && slot2?.storage_path && slot1?.enabled && slot2?.enabled);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Áudios de Saudação (Conexão Green)
          </CardTitle>
          <CardDescription>
            Substitui as 5 mensagens de texto da abertura por 2 áudios em sequência.
            Enquanto a função estiver desativada ou sem os 2 áudios configurados,
            a saudação volta automaticamente para o formato em texto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="font-medium">Ativar envio dos áudios na saudação</p>
              <p className="text-xs text-muted-foreground">
                Padrão: desativado. Só ligue depois de subir os 2 áudios abaixo.
              </p>
            </div>
            <Switch
              checked={enabled}
              disabled={setToggle.isPending}
              onCheckedChange={async (v) => {
                try {
                  await setToggle.mutateAsync(v);
                  toast.success(v ? "Áudios ativados" : "Áudios desativados");
                } catch (e) {
                  toast.error(`Erro: ${e instanceof Error ? e.message : String(e)}`);
                }
              }}
            />
          </div>

          {enabled && !bothConfigured && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500" />
              <span>
                Você ativou a função, mas ainda faltam áudios configurados. A IA vai
                continuar usando o texto padrão até os 2 slots estarem prontos e ativos.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2].map((slot) => (
          <SlotCard
            key={slot}
            slot={slot}
            current={audios.find((a) => a.slot === slot)}
            getSignedUrl={getSignedUrl}
            saving={saveSlot.isPending}
            onSave={async ({ transcript, enabled, file }) => {
              await saveSlot.mutateAsync({
                slot,
                transcript,
                enabled,
                delay_after_ms: SLOT_DEFAULTS[slot].delay,
                file,
              });
            }}
          />
        ))}
      </div>
    </div>
  );
}