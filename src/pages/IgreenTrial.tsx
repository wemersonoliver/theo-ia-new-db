import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Leaf } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export default function IgreenTrial() {
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (!digits.match(/^\d{10,11}$/)) return toast.error("Telefone deve ter DDD + número (10 ou 11 dígitos)");
    if (password.length < 6) return toast.error("Senha precisa ter pelo menos 6 caracteres");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("igreen-trial-register", {
        body: { email, password, full_name: fullName, phone: digits, business_name: businessName || fullName },
      });
      if (error || (data as any)?.error) {
        throw new Error((data as any)?.error || error?.message || "Falha no cadastro");
      }
      toast.success("Conta Igreen criada! Entrando...");
      await signIn(email, password);
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          "linear-gradient(135deg, hsl(135 75% 18%) 0%, hsl(105 65% 32%) 50%, hsl(38 95% 55%) 100%)",
      }}
    >
      <Card className="w-full max-w-md border-emerald-700/40 bg-background/95 backdrop-blur">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white">
            <Leaf className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl">Plano Igreen Energy — Teste grátis 7 dias</CardTitle>
          <CardDescription>
            Crie sua conta e ganhe 7 dias para testar todos os recursos do template Igreen,
            incluindo os 3 cenários de atendimento prontos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label htmlFor="fullName">Seu nome</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="businessName">Nome do seu negócio</Label>
              <Input id="businessName" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="phone">WhatsApp (DDD + número)</Label>
              <Input id="phone" placeholder="47999999999" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-600 to-amber-500 hover:from-emerald-700 hover:to-amber-600 text-white"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Começar teste grátis de 7 dias"}
            </Button>
            <p className="text-xs text-muted-foreground text-center pt-2">
              Após 7 dias, escolha um plano Igreen mensal ou anual para continuar.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}