import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Users,
  Search,
  Plus,
  Pencil,
  Trash2,
  MessageSquare,
  Loader2,
  RefreshCw,
  Phone,
  Mail,
  FileText,
  User,
  Tag,
  X,
} from "lucide-react";
import { useContacts, type Contact } from "@/hooks/useContacts";
import { TagInput, tagClass } from "@/components/TagInput";
import { useSearchParams } from "react-router-dom";

// ── Helpers ────────────────────────────────────────────────────────────────────
function getInitials(name: string | null, phone: string) {
  if (name?.trim()) {
    const parts = name.trim().split(" ");
    return parts.length > 1
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0][0].toUpperCase();
  }
  return phone.slice(-2);
}

function ContactAvatar({ name, phone }: { name: string | null; phone: string }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
      {getInitials(name, phone)}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface ContactFormData {
  phone: string;
  name: string;
  email: string;
  notes: string;
  tags: string[];
}

const emptyForm: ContactFormData = { phone: "", name: "", email: "", notes: "", tags: [] };

// ── Contact Form ──────────────────────────────────────────────────────────────
interface ContactFormProps {
  form: ContactFormData;
  setForm: (f: ContactFormData) => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
  phoneEditable?: boolean;
}

function ContactForm({ form, setForm, onSave, onCancel, isPending, phoneEditable }: ContactFormProps) {
  const update =
    (field: keyof ContactFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [field]: e.target.value });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cf-phone">Telefone *</Label>
        <Input
          id="cf-phone"
          value={form.phone}
          onChange={update("phone")}
          placeholder="+55 11 99999-9999"
          disabled={!phoneEditable}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cf-name">Nome</Label>
        <Input id="cf-name" value={form.name} onChange={update("name")} placeholder="Nome do contato" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cf-email">E-mail</Label>
        <Input id="cf-email" type="email" value={form.email} onChange={update("email")} placeholder="email@exemplo.com" />
      </div>
      <div className="space-y-2">
        <Label>Tags</Label>
        <TagInput tags={form.tags} onChange={(tags) => setForm({ ...form, tags })} />
        <p className="text-xs text-muted-foreground">
          Pressione Enter ou vírgula para adicionar.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="cf-notes">Anotações</Label>
        <Textarea
          id="cf-notes"
          value={form.notes}
          onChange={update("notes")}
          placeholder="Informações adicionais sobre o contato..."
          rows={3}
        />
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <Button variant="outline" onClick={onCancel} disabled={isPending}>
          Cancelar
        </Button>
        <Button onClick={onSave} disabled={isPending || !form.phone.trim()}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Contacts() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const autoOpenedRef = useRef<string | null>(null);
  const { contacts, isLoading, updateContact, deleteContact, createContact, syncFromConversations } =
    useContacts();

  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isNewDialog, setIsNewDialog] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<ContactFormData>(emptyForm);

  // Sync on first load
  useEffect(() => {
    syncFromConversations.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-open contact via ?open=PHONE (coming from Conversations page)
  useEffect(() => {
    const openPhone = searchParams.get("open");
    if (openPhone && contacts.length > 0 && autoOpenedRef.current !== openPhone) {
      autoOpenedRef.current = openPhone;
      const contact = contacts.find((c) => c.phone === openPhone);
      if (contact) openEdit(contact);
      // Remove o parâmetro da URL para não reabrir ao salvar
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, contacts]);

  const allTags = Array.from(new Set(contacts.flatMap((c) => c.tags))).sort();

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch =
      c.phone.includes(q) ||
      (c.name || "").toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      c.tags.some((t) => t.toLowerCase().includes(q));
    const matchTag = filterTag
      ? c.tags.map((t) => t.toLowerCase()).includes(filterTag.toLowerCase())
      : true;
    return matchSearch && matchTag;
  });

  function openEdit(contact: Contact) {
    setEditingContact(contact);
    setForm({
      phone: contact.phone,
      name: contact.name || "",
      email: contact.email || "",
      notes: contact.notes || "",
      tags: contact.tags || [],
    });
  }

  function openNew() {
    setForm(emptyForm);
    setIsNewDialog(true);
  }

  function handleSaveEdit() {
    if (!editingContact) return;
    updateContact.mutate({ id: editingContact.id, ...form }, { onSuccess: () => setEditingContact(null) });
  }

  function handleCreate() {
    createContact.mutate(
      { phone: form.phone, name: form.name, email: form.email, notes: form.notes, tags: form.tags },
      { onSuccess: () => setIsNewDialog(false) }
    );
  }

  function handleStartConversation(phone: string) {
    navigate(`/conversations?phone=${encodeURIComponent(phone)}`);
  }

  return (
    <DashboardLayout title="Contatos" description="Gerencie os contatos do seu WhatsApp">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone, email ou tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncFromConversations.mutate()}
            disabled={syncFromConversations.isPending}
          >
            {syncFromConversations.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sincronizar
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Contato
          </Button>
        </div>
      </div>

      {/* Tag filters */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={() => setFilterTag(null)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              filterTag === null
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            Todos ({contacts.length})
          </button>
          {allTags.map((tag) => {
            const count = contacts.filter((c) =>
              c.tags.map((t) => t.toLowerCase()).includes(tag.toLowerCase())
            ).length;
            return (
              <button
                key={tag}
                onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  filterTag === tag
                    ? "bg-primary text-primary-foreground border-primary"
                    : `${tagClass(tag)} hover:opacity-80`
                }`}
              >
                <Tag className="h-2.5 w-2.5" />
                {tag} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Stats */}
      <div className="mb-4">
        <Badge variant="secondary" className="text-sm px-3 py-1">
          <Users className="h-3.5 w-3.5 mr-1.5" />
          {filtered.length} de {contacts.length} contato{contacts.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <Users className="h-14 w-14 mb-4 opacity-30" />
          <p className="text-lg font-medium">
            {search || filterTag ? "Nenhum contato encontrado" : "Nenhum contato ainda"}
          </p>
          <p className="text-sm mt-1">
            {search || filterTag
              ? "Tente outra busca ou remova o filtro de tag"
              : "Sincronize para importar contatos das conversas ou crie um manualmente"}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((contact) => (
            <Card key={contact.id} className="group hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <ContactAvatar name={contact.name} phone={contact.phone} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {contact.name || <span className="text-muted-foreground italic">Sem nome</span>}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Phone className="h-3 w-3 shrink-0" />
                      <span className="truncate">{contact.phone}</span>
                    </div>
                    {contact.email && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate">{contact.email}</span>
                      </div>
                    )}
                    {contact.notes && (
                      <div className="flex items-start gap-1 text-xs text-muted-foreground mt-1">
                        <FileText className="h-3 w-3 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{contact.notes}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tags */}
                {contact.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {contact.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${tagClass(tag)}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-1.5 mt-4">
                  <Button
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={() => handleStartConversation(contact.phone)}
                  >
                    <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                    Conversar
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(contact)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 hover:border-destructive hover:text-destructive"
                    onClick={() => setDeleteId(contact.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingContact} onOpenChange={(o) => !o && setEditingContact(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Editar Contato
            </DialogTitle>
          </DialogHeader>
          <ContactForm
            form={form}
            setForm={setForm}
            onSave={handleSaveEdit}
            onCancel={() => setEditingContact(null)}
            isPending={updateContact.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* New Contact Dialog */}
      <Dialog open={isNewDialog} onOpenChange={(o) => !o && setIsNewDialog(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Novo Contato
            </DialogTitle>
          </DialogHeader>
          <ContactForm
            form={form}
            setForm={setForm}
            onSave={handleCreate}
            onCancel={() => setIsNewDialog(false)}
            isPending={createContact.isPending}
            phoneEditable
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover contato?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. O histórico de conversas não será afetado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) deleteContact.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
