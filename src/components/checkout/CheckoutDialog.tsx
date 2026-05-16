import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkoutUrl: string | null;
  planName?: string;
}

function buildEmbedUrl(url: string) {
  try {
    const u = new URL(url);
    u.searchParams.set("embed", "true");
    return u.toString();
  } catch {
    return url;
  }
}

export function CheckoutDialog({ open, onOpenChange, checkoutUrl, planName }: CheckoutDialogProps) {
  if (!checkoutUrl) return null;
  const embedUrl = buildEmbedUrl(checkoutUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl p-0 overflow-hidden h-[90vh] flex flex-col gap-0">
        <DialogHeader className="px-6 py-3 border-b flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-base">
            Finalizar assinatura{planName ? ` — ${planName}` : ""}
          </DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            className="mr-8"
            onClick={() => window.open(checkoutUrl, "_blank")}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir em nova aba
          </Button>
        </DialogHeader>
        <iframe
          src={embedUrl}
          title="Checkout Kiwify"
          className="flex-1 w-full border-0"
          allow="payment *; clipboard-write"
        />
      </DialogContent>
    </Dialog>
  );
}