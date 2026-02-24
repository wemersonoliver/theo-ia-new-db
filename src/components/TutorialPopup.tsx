import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const STORAGE_KEY = "tutorial_popup_dismissed";

interface TutorialPopupProps {
  externalOpen?: boolean;
  onExternalClose?: () => void;
}

export function TutorialPopup({ externalOpen, onExternalClose }: TutorialPopupProps) {
  const [autoOpen, setAutoOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const isOpen = externalOpen ?? autoOpen;

  useEffect(() => {
    if (externalOpen === undefined) {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) setAutoOpen(true);
    }
  }, [externalOpen]);

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, "true");
    }
    setAutoOpen(false);
    onExternalClose?.();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-[640px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="text-lg">🎓 Tutorial - Como usar o sistema</DialogTitle>
        </DialogHeader>

        <div className="px-4">
          <div className="relative w-full aspect-video rounded-md overflow-hidden bg-muted">
            <iframe
              src="https://www.youtube.com/embed/-MZHYGb0afQ"
              title="Tutorial"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          </div>
        </div>

        <DialogFooter className="p-4 pt-3 flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <Checkbox
              id="dontShow"
              checked={dontShowAgain}
              onCheckedChange={(v) => setDontShowAgain(v === true)}
            />
            <Label htmlFor="dontShow" className="text-sm text-muted-foreground cursor-pointer">
              Não mostrar novamente
            </Label>
          </div>
          <Button onClick={handleClose} variant="default">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
