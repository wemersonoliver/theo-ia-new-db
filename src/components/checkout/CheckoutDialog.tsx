import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkoutUrl: string | null;
  planName?: string;
}

/**
 * Kiwify bloqueia carregamento via iframe (X-Frame-Options).
 * Por isso o checkout é aberto em uma nova aba e o dialog
 * mostra apenas instruções + um botão de fallback.
 */
export function CheckoutDialog({ open, onOpenChange, checkoutUrl, planName }: CheckoutDialogProps) {
  const openedRef = useRef(false);

  useEffect(() => {
    if (open && checkoutUrl && !openedRef.current) {
      openedRef.current = true;
      window.open(checkoutUrl, "_blank", "noopener,noreferrer");
    }
    if (!open) openedRef.current = false;
  }, [open, checkoutUrl]);

  if (!checkoutUrl) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Finalizar assinatura{planName ? ` — ${planName}` : ""}
          </DialogTitle>
          <DialogDescription>
            O checkout foi aberto em uma nova aba. Se o popup foi bloqueado pelo navegador, clique no botão abaixo.
          </DialogDescription>
        </DialogHeader>
        <Button
          className="w-full"
          onClick={() => window.open(checkoutUrl, "_blank", "noopener,noreferrer")}
        >
          <ExternalLink className="h-4 w-4 mr-2" /> Abrir checkout
        </Button>
      </DialogContent>
    </Dialog>
  );
}