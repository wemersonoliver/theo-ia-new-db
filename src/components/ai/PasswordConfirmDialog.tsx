import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface PasswordConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmed: () => void | Promise<void>;
  title?: string;
  description?: string;
}

export function PasswordConfirmDialog({
  open,
  onOpenChange,
  onConfirmed,
  title = "Confirme sua senha",
  description = "Por segurança, digite a senha da sua conta para salvar alterações no prompt do agente IA.",
}: PasswordConfirmDialogProps) {
  const { user } = useAuth();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!user?.email) {
      toast.error("Sessão inválida");
      return;
    }
    if (!password) {
      toast.error("Digite sua senha");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });
      if (error) {
        toast.error("Senha incorreta");
        return;
      }
      setPassword("");
      onOpenChange(false);
      await onConfirmed();
    } catch {
      toast.error("Erro ao validar senha");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!loading) onOpenChange(o); if (!o) setPassword(""); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="confirm-password">Senha de acesso</Label>
          <Input
            id="confirm-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Digite sua senha"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleConfirm();
              }
            }}
          />
          <p className="text-xs text-muted-foreground">
            Usuário: <strong>{user?.email}</strong>
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={loading || !password}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar e salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}