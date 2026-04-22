import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Loader2, MessageSquareX, UserX } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/useAccount";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function DangerZoneTab() {
  const { user } = useAuth();
  const { accountId, isOwner } = useAccount();
  const queryClient = useQueryClient();

  const [confirmConvOpen, setConfirmConvOpen] = useState(false);
  const [confirmContactsOpen, setConfirmContactsOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loadingConv, setLoadingConv] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);

  if (!isOwner) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Área Restrita
          </CardTitle>
          <CardDescription>
            Apenas o proprietário da conta pode acessar esta área.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleClearConversations = async () => {
    if (!accountId || confirmText !== "ZERAR CONVERSAS") {
      toast.error("Digite exatamente: ZERAR CONVERSAS");
      return;
    }
    setLoadingConv(true);
    try {
      // Apaga conversas, sessões da IA e respostas pendentes (que tenham account_id)
      const [convRes, sessRes] = await Promise.all([
        supabase.from("whatsapp_conversations").delete().eq("account_id", accountId),
        supabase.from("whatsapp_ai_sessions").delete().eq("account_id", accountId),
      ]);
      if (convRes.error) throw convRes.error;
      if (sessRes.error) throw sessRes.error;

      // Limpa followup tracking do usuário
      if (user) {
        await supabase.from("followup_tracking").delete().eq("user_id", user.id);
      }

      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast.success("Todas as conversas foram apagadas!");
      setConfirmConvOpen(false);
      setConfirmText("");
    } catch (e: any) {
      toast.error(`Erro ao apagar conversas: ${e.message}`);
    } finally {
      setLoadingConv(false);
    }
  };

  const handleClearContacts = async () => {
    if (!accountId || confirmText !== "ZERAR CONTATOS") {
      toast.error("Digite exatamente: ZERAR CONTATOS");
      return;
    }
    setLoadingContacts(true);
    try {
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("account_id", accountId);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Todos os contatos foram apagados!");
      setConfirmContactsOpen(false);
      setConfirmText("");
    } catch (e: any) {
      toast.error(`Erro ao apagar contatos: ${e.message}`);
    } finally {
      setLoadingContacts(false);
    }
  };

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Zona de Perigo
        </CardTitle>
        <CardDescription>
          Ações irreversíveis. Use com cuidado — recomendado apenas para testes ou
          quando deseja recomeçar do zero com um novo número.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border border-destructive/30 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <MessageSquareX className="h-5 w-5 text-destructive mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold">Zerar todas as conversas</h4>
              <p className="text-sm text-muted-foreground">
                Apaga permanentemente todas as conversas do WhatsApp, sessões da IA e
                histórico de follow-up desta conta. Os contatos serão mantidos.
              </p>
            </div>
          </div>
          <Button
            variant="destructive"
            onClick={() => { setConfirmText(""); setConfirmConvOpen(true); }}
          >
            Zerar conversas
          </Button>
        </div>

        <div className="rounded-lg border border-destructive/30 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <UserX className="h-5 w-5 text-destructive mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold">Zerar todos os contatos</h4>
              <p className="text-sm text-muted-foreground">
                Apaga permanentemente todos os contatos cadastrados nesta conta. As
                conversas serão mantidas (mas ficarão sem nome associado).
              </p>
            </div>
          </div>
          <Button
            variant="destructive"
            onClick={() => { setConfirmText(""); setConfirmContactsOpen(true); }}
          >
            Zerar contatos
          </Button>
        </div>
      </CardContent>

      {/* Confirm conversas */}
      <AlertDialog open={confirmConvOpen} onOpenChange={setConfirmConvOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar exclusão de conversas
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é <strong>irreversível</strong>. Todas as conversas, sessões da
              IA e follow-ups serão apagados permanentemente.
              <br /><br />
              Para confirmar, digite <strong>ZERAR CONVERSAS</strong> abaixo:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-conv">Confirmação</Label>
            <Input
              id="confirm-conv"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="ZERAR CONVERSAS"
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmText("")}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleClearConversations(); }}
              disabled={loadingConv || confirmText !== "ZERAR CONVERSAS"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loadingConv && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apagar tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm contatos */}
      <AlertDialog open={confirmContactsOpen} onOpenChange={setConfirmContactsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar exclusão de contatos
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é <strong>irreversível</strong>. Todos os contatos cadastrados
              nesta conta serão apagados permanentemente.
              <br /><br />
              Para confirmar, digite <strong>ZERAR CONTATOS</strong> abaixo:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-contacts">Confirmação</Label>
            <Input
              id="confirm-contacts"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="ZERAR CONTATOS"
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmText("")}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleClearContacts(); }}
              disabled={loadingContacts || confirmText !== "ZERAR CONTATOS"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loadingContacts && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apagar tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
