import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import theoLogo from "@/assets/logo_theo_ia.png";

export default function AdminLogin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  // If already logged in, check role and redirect
  if (user && !checking) {
    setChecking(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .then(({ data }) => {
        if (data && data.length > 0) {
          navigate("/admin/dashboard", { replace: true });
        } else {
          toast.error("Acesso restrito a administradores.");
          setChecking(false);
        }
      });
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      toast.error("Credenciais inválidas.");
      setLoading(false);
      return;
    }

    // Check super_admin role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", authData.user.id)
      .eq("role", "super_admin");

    if (!roles || roles.length === 0) {
      await supabase.auth.signOut();
      toast.error("Acesso restrito a administradores.");
      setLoading(false);
      return;
    }

    navigate("/admin/dashboard", { replace: true });
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(222,47%,5%)]">
      <div className="w-full max-w-sm space-y-8 px-6">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <img src={theoLogo} alt="Theo IA" className="h-10 w-10 rounded-lg" />
            <div>
              <h1 className="text-xl font-bold text-white">Theo IA</h1>
              <p className="text-xs text-slate-400">Painel Administrativo</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-medium text-amber-400">Área Restrita</span>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm text-slate-300">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@theo.ia"
              required
              className="border-slate-700 bg-slate-800/50 text-white placeholder:text-slate-500 focus-visible:ring-amber-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm text-slate-300">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="border-slate-700 bg-slate-800/50 text-white placeholder:text-slate-500 focus-visible:ring-amber-500"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 text-black hover:bg-amber-400 font-semibold"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Lock className="mr-2 h-4 w-4" />
            )}
            Acessar Painel
          </Button>
        </form>

        <p className="text-center text-xs text-slate-600">
          Acesso exclusivo para administradores da plataforma
        </p>
      </div>
    </div>
  );
}
