import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, Loader2, Trash2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AudioRecordButtonProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
}

type RecordState = "idle" | "recording" | "transcribing";

export function AudioRecordButton({ onTranscription, disabled }: AudioRecordButtonProps) {
  const [state, setState] = useState<RecordState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelledRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (state === "recording") {
      setElapsed(0);
      timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [state]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Pick a supported mime type
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
        ? "audio/ogg;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop());

        if (cancelledRef.current) {
          cancelledRef.current = false;
          chunksRef.current = [];
          setState("idle");
          return;
        }

        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size < 1000) {
          toast.error("Áudio muito curto. Tente novamente.");
          setState("idle");
          return;
        }

        setState("transcribing");

        try {
          // Convert to base64
          const buffer = await blob.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);

          const { data, error } = await supabase.functions.invoke("transcribe-browser-audio", {
            body: { audio: base64, mimeType },
          });

          if (error) throw error;
          if (!data?.text) throw new Error("Nenhum texto transcrito");

          onTranscription(data.text);
        } catch (err: any) {
          console.error("Transcription error:", err);
          toast.error("Erro ao transcrever áudio: " + (err.message || "Erro desconhecido"));
        } finally {
          setState("idle");
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setState("recording");
    } catch (err: any) {
      console.error("Microphone access error:", err);
      toast.error("Não foi possível acessar o microfone. Verifique as permissões.");
    }
  }, [onTranscription]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      cancelledRef.current = false;
      mediaRecorderRef.current.stop();
    }
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      cancelledRef.current = true;
      mediaRecorderRef.current.stop();
    }
  }, []);

  const handleClick = () => {
    if (state === "idle") startRecording();
    else if (state === "recording") stopRecording();
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  return (
    <>
      <Button
        type="button"
        variant={state === "recording" ? "destructive" : "outline"}
        size="icon"
        onClick={handleClick}
        disabled={disabled || state === "transcribing"}
        title={
          state === "idle"
            ? "Gravar áudio"
            : state === "recording"
            ? "Parar gravação"
            : "Transcrevendo..."
        }
        className={state === "recording" ? "animate-pulse" : ""}
      >
        {state === "transcribing" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : state === "recording" ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>

      {state === "recording" && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur-sm shadow-lg sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2 sm:rounded-full sm:border sm:inset-x-auto">
          <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={cancelRecording}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive transition-colors"
              title="Cancelar"
            >
              <Trash2 className="h-5 w-5" />
            </button>

            <div className="flex flex-1 items-center justify-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-destructive" />
              </span>
              <span className="font-mono text-sm tabular-nums text-foreground">
                {formatTime(elapsed)}
              </span>
              <div className="flex items-end gap-0.5 h-5">
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                  <span
                    key={i}
                    className="w-0.5 bg-destructive rounded-full animate-pulse"
                    style={{
                      height: `${30 + ((i * 17) % 70)}%`,
                      animationDelay: `${i * 100}ms`,
                      animationDuration: "800ms",
                    }}
                  />
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={stopRecording}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              title="Enviar"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
