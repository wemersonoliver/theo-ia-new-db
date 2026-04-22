import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getImpersonationTarget,
  stopImpersonation,
  type ImpersonationTarget,
} from "@/lib/impersonation";
import { useToast } from "@/hooks/use-toast";

export function ImpersonationBanner() {
  const [target, setTarget] = useState<ImpersonationTarget | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const sync = () => setTarget(getImpersonationTarget());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("impersonation-changed", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("impersonation-changed", sync);
    };
  }, []);

  if (!target) return null;

  const handleExit = async () => {
    setLoading(true);
    try {
      await stopImpersonation();
      window.dispatchEvent(new Event("impersonation-changed"));
      toast({ title: "Sessão restaurada", description: "Você voltou para sua conta de admin." });
      navigate("/admin/users", { replace: true });
    } catch (err) {
      toast({
        title: "Erro ao sair",
        description: (err as Error).message,
        variant: "destructive",
      });
      navigate("/admin/login", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const label = target.full_name ? `${target.full_name} (${target.email})` : target.email;

  return (
    <div className="fixed top-0 inset-x-0 z-[100] bg-amber-500 text-slate-900 shadow-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span className="truncate">
            <strong>Modo Suporte:</strong> você está acessando como <strong>{label}</strong>
          </span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleExit}
          disabled={loading}
          className="bg-slate-900 text-amber-400 hover:bg-slate-800 shrink-0"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          Sair do modo suporte
        </Button>
      </div>
    </div>
  );
}