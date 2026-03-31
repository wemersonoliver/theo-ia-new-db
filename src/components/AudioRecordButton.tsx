import { useState, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
          toast.success("Áudio transcrito com sucesso!");
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
      mediaRecorderRef.current.stop();
    }
  }, []);

  const handleClick = () => {
    if (state === "idle") startRecording();
    else if (state === "recording") stopRecording();
  };

  return (
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
  );
}
