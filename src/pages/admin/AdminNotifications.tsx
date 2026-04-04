import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminNotificationContacts } from "@/hooks/useAdminNotificationContacts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Bell, Plus, Trash2, Loader2, Phone, User } from "lucide-react";
import { toast } from "sonner";

export default function AdminNotifications() {
  const { contacts, isLoading, createContact, toggleContact, deleteContact } = useAdminNotificationContacts();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 10) {
      toast.error("Informe um número válido com DDD");
      return;
    }
    createContact.mutate({ phone: cleaned, name: name || undefined }, {
      onSuccess: () => { setPhone(""); setName(""); }
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell className="h-6 w-6 text-amber-400" />
            Notificações
          </h1>
          <p className="text-slate-400 mt-1">
            Gerencie os contatos que receberão alertas de novos cadastros via WhatsApp
          </p>
        </div>

        {/* Add contact form */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-lg">Adicionar contato</CardTitle>
            <CardDescription>Cadastre números que serão notificados a cada novo usuário</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-slate-300 text-xs">Nome (opcional)</Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <Input
                    placeholder="Ex: João"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-9 bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-slate-300 text-xs">Telefone (WhatsApp)</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <Input
                    placeholder="5547999999999"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="pl-9 bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={createContact.isPending} className="bg-amber-500 hover:bg-amber-600 text-black">
                  {createContact.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                  Adicionar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Contacts list */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-lg">Contatos cadastrados</CardTitle>
            <CardDescription>
              {contacts.length} contato{contacts.length !== 1 ? "s" : ""} cadastrado{contacts.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
              </div>
            ) : contacts.length === 0 ? (
              <p className="text-slate-500 text-center py-8">Nenhum contato cadastrado ainda.</p>
            ) : (
              <div className="space-y-3">
                {contacts.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`h-2.5 w-2.5 rounded-full ${c.active ? "bg-emerald-400" : "bg-slate-600"}`} />
                      <div>
                        <p className="text-sm font-medium text-white">
                          {c.name || "Sem nome"}
                        </p>
                        <p className="text-xs text-slate-400">{c.phone}</p>
                      </div>
                      <Badge variant={c.active ? "default" : "secondary"} className="text-[10px]">
                        {c.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={c.active}
                        onCheckedChange={(val) => toggleContact.mutate({ id: c.id, active: val })}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                        onClick={() => deleteContact.mutate(c.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
