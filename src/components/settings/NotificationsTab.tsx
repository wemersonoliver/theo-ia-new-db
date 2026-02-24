import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useNotificationContacts, NotificationContact } from "@/hooks/useNotificationContacts";
import { Bell, Plus, Trash2, Loader2, Phone, User } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function NotificationsTab() {
  const { contacts, isLoading, createContact, updateContact, deleteContact } = useNotificationContacts();
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");

  const handleAdd = () => {
    if (!newPhone.trim()) return;
    createContact.mutate(
      { phone: newPhone.trim(), name: newName.trim() || undefined },
      {
        onSuccess: () => {
          setNewPhone("");
          setNewName("");
        },
      }
    );
  };

  const handleToggle = (contact: NotificationContact, field: "notify_appointments" | "notify_handoffs") => {
    updateContact.mutate({ id: contact.id, [field]: !contact[field] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Contatos para Notificações
        </CardTitle>
        <CardDescription>
          Cadastre números que receberão notificações via WhatsApp quando houver transferência de atendimento da IA ou novos agendamentos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add form */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 space-y-1">
            <Label htmlFor="notif-name" className="text-xs text-muted-foreground">Nome</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="notif-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome (opcional)"
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex-1 space-y-1">
            <Label htmlFor="notif-phone" className="text-xs text-muted-foreground">Telefone</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="notif-phone"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="5547999999999"
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex items-end">
            <Button onClick={handleAdd} disabled={createContact.isPending || !newPhone.trim()}>
              {createContact.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Adicionar
            </Button>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum contato cadastrado para notificações.
          </p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="text-center">Agendamentos</TableHead>
                  <TableHead className="text-center">Transferências</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.name || "—"}</TableCell>
                    <TableCell className="font-mono text-sm">{c.phone}</TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={c.notify_appointments}
                        onCheckedChange={() => handleToggle(c, "notify_appointments")}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={c.notify_handoffs}
                        onCheckedChange={() => handleToggle(c, "notify_handoffs")}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteContact.mutate(c.id)}
                        disabled={deleteContact.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
