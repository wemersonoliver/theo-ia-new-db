import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PhoneRequiredDialogProps {
  open: boolean;
  userId: string;
  onPhoneSaved: () => void;
}

export function PhoneRequiredDialog({ open, userId, onPhoneSaved }: PhoneRequiredDialogProps) {
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone.match(/^\d{10,11}$/)) {
      toast.error("Informe um telefone válido com DDD (ex: 47999999999)");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ phone: cleanPhone })
      .eq("user_id", userId);

    if (error) {
      toast.error("Erro ao salvar telefone");
    } else {
      toast.success("Telefone cadastrado com sucesso!");
      onPhoneSaved();
    }
    setSaving(false);
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()} hideCloseButton>
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Phone className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Cadastre seu telefone</DialogTitle>
          <DialogDescription className="text-center">
            Para continuar usando o sistema, precisamos do seu número de WhatsApp com DDD.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="phone-required">Telefone (WhatsApp)</Label>
          <Input
            id="phone-required"
            type="tel"
            placeholder="47999999999"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar e continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
