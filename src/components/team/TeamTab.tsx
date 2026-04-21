import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserPlus, Pencil, Trash2, KeyRound, ShieldCheck } from "lucide-react";
import { useAccount } from "@/hooks/useAccount";
import { useTeamMembers, TeamMember } from "@/hooks/useTeamMembers";
import { TeamMemberDialog } from "./TeamMemberDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const ROLE_LABELS: Record<string, string> = {
  owner: "Dono",
  manager: "Gerente",
  seller: "Vendedor",
  agent: "Atendente",
};

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-primary text-primary-foreground",
  manager: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  seller: "bg-green-500/20 text-green-700 dark:text-green-300",
  agent: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
};

export function TeamTab() {
  const { isOwner, isLoading } = useAccount();
  const { members, isLoading: loadingMembers, remove, resetPassword } = useTeamMembers();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
    );
  }

  if (!isOwner) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Acesso restrito
          </CardTitle>
          <CardDescription>Apenas o dono da conta pode gerenciar a equipe.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const openCreate = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (m: TeamMember) => { setEditing(m); setDialogOpen(true); };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Equipe</CardTitle>
            <CardDescription>
              Cadastre vendedores e atendentes. Cada um vê apenas as áreas e registros que você permitir.
            </CardDescription>
          </div>
          <Button onClick={openCreate}>
            <UserPlus className="mr-2 h-4 w-4" /> Convidar membro
          </Button>
        </CardHeader>
        <CardContent>
          {loadingMembers ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : members.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum membro ainda. Clique em "Convidar membro" para começar.
            </p>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{m.full_name || m.email || "Sem nome"}</span>
                      <Badge className={ROLE_COLORS[m.role]}>{ROLE_LABELS[m.role]}</Badge>
                      {m.status === "suspended" && <Badge variant="outline">Suspenso</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {m.email}{m.phone ? ` • ${m.phone}` : ""}
                    </p>
                  </div>
                  {m.role !== "owner" && (
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(m)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => resetPassword.mutate(m.id)} title="Enviar nova senha">
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover {m.full_name || m.email}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta pessoa perderá o acesso imediatamente. O histórico (conversas, deals atribuídos) é preservado.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove.mutate(m.id)}>Remover</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <TeamMemberDialog open={dialogOpen} onOpenChange={setDialogOpen} member={editing} />
    </div>
  );
}