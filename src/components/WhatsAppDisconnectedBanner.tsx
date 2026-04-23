import { AlertTriangle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useWhatsAppInstance } from "@/hooks/useWhatsAppInstance";

export function WhatsAppDisconnectedBanner() {
  const { instance, isLoading } = useWhatsAppInstance();
  const location = useLocation();

  if (isLoading || !instance) return null;
  if (instance.status !== "disconnected") return null;
  // Don't show on the WhatsApp page itself (user is already there)
  if (location.pathname === "/whatsapp") return null;

  return (
    <div className="border-b border-destructive/40 bg-destructive/10">
      <div className="container flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 text-sm text-destructive sm:items-center">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 sm:mt-0" />
          <div>
            <span className="font-semibold">WhatsApp desconectado.</span>{" "}
            <span className="text-destructive/90">
              Sua IA não está respondendo. Reconecte agora para voltar a atender seus clientes.
            </span>
          </div>
        </div>
        <Button asChild size="sm" variant="destructive" className="shrink-0">
          <Link to="/whatsapp">Reconectar</Link>
        </Button>
      </div>
    </div>
  );
}