import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  phone: string;
  disabled?: boolean;
  onSend: (args: { file: File; caption: string; phone: string }) => Promise<void>;
  isSending?: boolean;
  className?: string;
}

type State = "idle" | "recording" | "sending";

export function RecordSendAudioButton({ phone, disabled, onSend, isSending, className }: Props) {
  const [state, setState] = useState<State>("idle");
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelledRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (state === "recording") {
      setElapsed(0);
      timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state]);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
        ? "audio/ogg;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (cancelledRef.current) {
          cancelledRef.current = false;
          chunksRef.current = [];
          setState("idle");
          return;
        }
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size < 1000) {
          toast.error("Áudio muito curto.");
          setState("idle");
          return;
        }
        setState("sending");
        try {
          const ext = mimeType.includes("ogg") ? "ogg" : "webm";
          const file = new File([blob], `audio_${Date.now()}.${ext}`, { type: mimeType });
          await onSend({ file, caption: "", phone });
        } catch (err: any) {
          console.error("Send audio error:", err);
        } finally {
          setState("idle");
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setState("recording");
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível acessar o microfone.");
    }
  }, [onSend, phone]);

  const stop = () => {
    if (recorderRef.current?.state === "recording") {
      cancelledRef.current = false;
      recorderRef.current.stop();
    }
  };
  const cancel = () => {
    if (recorderRef.current?.state === "recording") {
      cancelledRef.current = true;
      recorderRef.current.stop();
    }
  };

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (state === "recording") {
    return (
      <div className={cn("flex items-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1", className)}>
        <button type="button" onClick={cancel} className="text-slate-400 hover:text-red-400 p-1" title="Cancelar">
          <Trash2 className="h-4 w-4" />
        </button>
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
        </span>
        <span className="font-mono text-xs tabular-nums text-slate-200">{fmt(elapsed)}</span>
        <button type="button" onClick={stop} className="ml-1 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600" title="Enviar">
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={disabled || isSending || state === "sending"}
      onClick={start}
      className={cn("shrink-0", className)}
      title="Gravar áudio"
    >
      {state === "sending" || isSending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Mic className="h-5 w-5" />
      )}
    </Button>
  );
}