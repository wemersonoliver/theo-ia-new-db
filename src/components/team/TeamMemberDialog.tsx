import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { TeamMember, useTeamMembers } from "@/hooks/useTeamMembers";
import { AccountRole } from "@/hooks/useAccount";

const PERMISSIONS: { key: string; label: string; group: string }[] = [
  { key: "conversations", label: "Conversas", group: "Operacional" },
  { key: "crm", label: "CRM (deals, pipelines, produtos)", group: "Operacional" },
  { key: "contacts", label: "Contatos", group: "Operacional" },
  { key: "appointments", label: "Agendamentos", group: "Operacional" },
  { key: "appointment_settings", label: "Config. de horários", group: "Operacional" },
  { key: "view_all_assigned", label: "Ver registros de toda a equipe (não só os atribuídos)", group: "Operacional" },
  { key: "knowledge_base", label: "Base de Conhecimento", group: "Configuração" },
  { key: "ai_config", label: "Configuração da IA / Follow-up", group: "Configuração" },
  { key: "whatsapp_instance", label: "Instância do WhatsApp", group: "Configuração" },
  { key: "settings", label: "Configurações gerais", group: "Configuração" },
  { key: "support", label: "Suporte / Tickets", group: "Configuração" },
  { key: "billing", label: "Assinatura / Faturamento", group: "Restrito" },
  { key: "team_management", label: "Gerenciar equipe", group: "Restrito" },
];

const ROLE_DEFAULTS: Record<Exclude<AccountRole, "owner">, string[]> = {
  manager: ["conversations","crm","contacts","appointments","appointment_settings","knowledge_base","ai_config","whatsapp_instance","settings","support","view_all_assigned"],
  seller: ["conversations","crm","contacts","appointments","settings","support"],
  agent: ["conversations","appointments","contacts","settings","support"],
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  member?: TeamMember | null;
}

export function TeamMemberDialog({ open, onOpenChange, member }: Props) {
  const { invite, update } = useTeamMembers();
  const isEditing = !!member;

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"manager" | "seller" | "agent">("agent");
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (member) {
      setFullName(member.full_name || "");
      setPhone(member.phone || "");
      setEmail(member.email || "");
      setRole(member.role === "owner" ? "manager" : (member.role as any));
      setOverrides(member.permissions || {});
    } else {
      setFullName(""); setPhone(""); setEmail(""); setRole("agent"); setOverrides({});
    }
  }, [member, open]);

  const isChecked = (key: string) => {
    if (Object.prototype.hasOwnProperty.call(overrides, key)) return overrides[key];
    return ROLE_DEFAULTS[role]?.includes(key) ?? false;
  };

  const isOverridden = (key: string) => Object.prototype.hasOwnProperty.call(overrides, key);

  const togglePerm = (key: string, checked: boolean) => {
    const baseDefault = ROLE_DEFAULTS[role]?.includes(key) ?? false;
    setOverrides((prev) => {
      const next = { ...prev };
      // Se voltar pro default, remove o override
      if (checked === baseDefault) delete next[key];
      else next[key] = checked;
      return next;
    });
  };

  const onSubmit = async () => {
    if (isEditing && member) {
      await update.mutateAsync({ member_id: member.id, role, permissions: overrides });
    } else {
      if (!fullName.trim() || !phone.trim()) return;
      await invite.mutateAsync({ full_name: fullName, phone, email: email || undefined, role, permissions: overrides });
    }
    onOpenChange(false);
  };

  const grouped = PERMISSIONS.reduce<Record<string, typeof PERMISSIONS>>((acc, p) => {
    (acc[p.group] ||= []).push(p);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar membro" : "Convidar membro"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Ajuste o papel e as permissões avulsas. Marque/desmarque caixas para sobrescrever os padrões do papel."
              : "Cadastre um novo vendedor ou atendente. Ele receberá uma senha provisória pelo WhatsApp."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isEditing && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Nome completo *</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp *</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email (opcional — usado para login)</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
                <p className="text-xs text-muted-foreground">Se vazio, geramos um email interno automaticamente.</p>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Papel</Label>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">Gerente — quase tudo, sem assinatura/equipe</SelectItem>
                <SelectItem value="seller">Vendedor — CRM, contatos e conversas atribuídas</SelectItem>
                <SelectItem value="agent">Atendente — conversas e agendamentos atribuídos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Permissões</Label>
            <p className="text-xs text-muted-foreground">
              Caixas marcadas em <span className="font-semibold text-primary">azul</span> são overrides — sobrescrevem o padrão do papel.
            </p>
            {Object.entries(grouped).map(([group, perms]) => (
              <div key={group} className="space-y-2 rounded-md border p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">{group}</p>
                {perms.map((p) => (
                  <div key={p.key} className="flex items-start gap-2">
                    <Checkbox
                      id={`perm-${p.key}`}
                      checked={isChecked(p.key)}
                      onCheckedChange={(c) => togglePerm(p.key, !!c)}
                    />
                    <label htmlFor={`perm-${p.key}`} className={`text-sm leading-tight cursor-pointer ${isOverridden(p.key) ? "text-primary font-medium" : ""}`}>
                      {p.label}
                    </label>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={invite.isPending || update.isPending}>
            {(invite.isPending || update.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Salvar" : "Convidar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}