import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { AssigneeSelector } from "@/components/team/AssigneeSelector";
import { AppointmentDialog } from "@/components/appointments/AppointmentDialog";
import { TagInput } from "@/components/TagInput";
import { DealQuickActions } from "./DealQuickActions";
import { DealActivityTimeline } from "./DealActivityTimeline";
import { CRMDeal } from "@/hooks/useCRMDeals";
import { CRMStage } from "@/hooks/useCRMStages";
import { useDealRelatedData, normalizePhone } from "@/hooks/useDealRelatedData";
import { useAppointments } from "@/hooks/useAppointments";
import { logDealActivity } from "@/hooks/useCRMActivities";
import { useAuth } from "@/lib/auth";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  X,
  Phone,
  Copy,
  Check,
  AlertTriangle,
  MessageSquare,
  Calendar,
  ExternalLink,
  Trash2,
  ChevronDown,
  ChevronUp,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DealDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: CRMDeal | null;
  stages: CRMStage[];
  contacts?: { id: string; name: string | null; phone: string }[];
  availableTags?: string[];
  onUpdate: (id: string, updates: Partial<CRMDeal>) => void;
  onDelete: (id: string) => void;
  onMarkWon?: (id: string) => Promise<void> | void;
  onMarkLost?: (id: string, reason: string) => Promise<void> | void;
}

function formatBRL(cents: number | null | undefined) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatPhoneBR(raw: string | null | undefined) {
  if (!raw) return "";
  const p = raw.replace(/\D/g, "");
  // strip 55 prefix for display
  const local = p.startsWith("55") && (p.length === 12 || p.length === 13) ? p.slice(2) : p;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return raw;
}

export function DealDetailsDrawer({
  open,
  onOpenChange,
  deal,
  stages,
  contacts = [],
  availableTags,
  onUpdate,
  onDelete,
  onMarkWon,
  onMarkLost,
}: DealDetailsDrawerProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { createAppointment } = useAppointments();

  // Inline edit state
  const [titleDraft, setTitleDraft] = useState("");
  const [valueDraft, setValueDraft] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingValue, setEditingValue] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState<"phone" | "value" | null>(null);

  // Lost dialog
  const [lostOpen, setLostOpen] = useState(false);
  const [lostReason, setLostReason] = useState("");

  // Delete confirmation
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Schedule dialog
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const linkedContact = useMemo(
    () => contacts.find((contact) => contact.id === deal?.contact_id) || null,
    [contacts, deal?.contact_id]
  );
  const contactName = deal?.contact_name || linkedContact?.name || deal?.title || null;
  const phone = deal?.contact_phone || linkedContact?.phone || null;
  const phoneFormatted = useMemo(() => formatPhoneBR(phone), [phone]);
  const phoneNormalized = useMemo(() => normalizePhone(phone), [phone]);

  const { data: related } = useDealRelatedData(phone, open && !!phone);

  const currentStage = useMemo(
    () => stages.find((s) => s.id === deal?.stage_id),
    [stages, deal?.stage_id]
  );

  const isWon = !!deal?.won_at;
  const isLost = !!deal?.lost_at;

  // Days idle in stage
  const daysInStage = deal
    ? Math.floor((Date.now() - new Date(deal.updated_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  useEffect(() => {
    if (open && deal) {
      setTitleDraft(deal.title);
      setValueDraft(deal.value_cents != null ? (deal.value_cents / 100).toFixed(2) : "");
      setEditingTitle(false);
      setEditingValue(false);
      setShowDetails(false);
    }
  }, [open, deal]);

  // Keyboard shortcut: W marks won
  useEffect(() => {
    if (!open || !deal) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.key === "w" || e.key === "W") && !isWon) {
        e.preventDefault();
        handleMarkWon();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deal, isWon]);

  if (!deal) return null;

  const copy = async (text: string, kind: "phone" | "value") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
      toast.success("Copiado!");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const handleSaveTitle = () => {
    const t = titleDraft.trim();
    if (t && t !== deal.title) {
      onUpdate(deal.id, { title: t });
    }
    setEditingTitle(false);
  };

  const handleSaveValue = () => {
    const cents = valueDraft ? Math.round(parseFloat(valueDraft.replace(",", ".")) * 100) : null;
    if (cents !== deal.value_cents) {
      onUpdate(deal.id, { value_cents: cents });
      if (user) {
        logDealActivity(
          deal.id,
          user.id,
          "note",
          `Valor atualizado para ${formatBRL(cents)}`
        );
      }
    }
    setEditingValue(false);
  };

  const handleStageChange = (newStageId: string) => {
    if (newStageId === deal.stage_id) return;
    const fromStage = stages.find((s) => s.id === deal.stage_id);
    const toStage = stages.find((s) => s.id === newStageId);
    onUpdate(deal.id, { stage_id: newStageId });
    if (user && fromStage && toStage) {
      logDealActivity(
        deal.id,
        user.id,
        "stage_change",
        `Movido de "${fromStage.name}" → "${toStage.name}"`
      );
    }
  };

  const handlePriorityChange = (p: string) => {
    onUpdate(deal.id, { priority: p });
  };

  const handleAssigneeChange = (uid: string | null) => {
    onUpdate(deal.id, { assigned_to: uid } as any);
    if (user) {
      logDealActivity(deal.id, user.id, "assigned", uid ? "Responsável atualizado" : "Responsável removido");
    }
  };

  const handleWhatsApp = () => {
    if (!phoneNormalized) return;
    onOpenChange(false);
    navigate(`/conversations?phone=${phoneNormalized}`);
  };

  const handleSchedule = () => setScheduleOpen(true);

  const handleMarkWon = async () => {
    if (isWon) return;
    if (onMarkWon) {
      await onMarkWon(deal.id);
    } else {
      onUpdate(deal.id, { won_at: new Date().toISOString() } as any);
      if (user) {
        logDealActivity(deal.id, user.id, "won", `Negócio marcado como ganho 🎉`);
      }
    }
    toast.success("Negócio marcado como Ganho! 🎉");
  };

  const handleConfirmLost = async () => {
    const reason = lostReason.trim() || "Sem motivo informado";
    if (onMarkLost) {
      await onMarkLost(deal.id, reason);
    } else {
      onUpdate(deal.id, { lost_at: new Date().toISOString(), lost_reason: reason } as any);
      if (user) {
        logDealActivity(deal.id, user.id, "lost", `Negócio perdido. Motivo: ${reason}`);
      }
    }
    setLostOpen(false);
    setLostReason("");
    toast.success("Negócio marcado como Perdido");
  };

  const stageColor = currentStage?.color || "hsl(var(--primary))";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[520px] p-0 flex flex-col gap-0 border-l-4"
          style={{ borderLeftColor: stageColor }}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 px-5 pt-5 pb-3 border-b">
            <div className="flex-1 min-w-0">
              {editingTitle ? (
                <Input
                  autoFocus
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveTitle();
                    if (e.key === "Escape") {
                      setTitleDraft(deal.title);
                      setEditingTitle(false);
                    }
                  }}
                  className="text-lg font-semibold h-9"
                />
              ) : (
                <h2
                  className="text-lg font-semibold leading-tight cursor-pointer hover:text-primary truncate"
                  onClick={() => setEditingTitle(true)}
                  title="Clique para editar"
                >
                  {deal.title}
                </h2>
              )}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge
                  variant="outline"
                  className="text-xs"
                  style={{ borderColor: stageColor, color: stageColor }}
                >
                  {currentStage?.name || "Sem estágio"}
                </Badge>
                {isWon && (
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 text-xs">
                    Ganho
                  </Badge>
                )}
                {isLost && (
                  <Badge variant="destructive" className="text-xs">
                    Perdido
                  </Badge>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Idle warning */}
            {!isWon && !isLost && daysInStage > 7 && (
              <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Parado há {daysInStage} dias neste estágio — vale dar um follow-up?
                </span>
              </div>
            )}

            {/* Quick actions */}
            <DealQuickActions
              hasPhone={!!phoneNormalized}
              isWon={isWon}
              isLost={isLost}
              onWhatsApp={handleWhatsApp}
              onSchedule={handleSchedule}
              onMarkWon={handleMarkWon}
              onMarkLost={() => setLostOpen(true)}
            />

            {/* Value + priority + stage */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Valor</Label>
                {editingValue ? (
                  <Input
                    autoFocus
                    value={valueDraft}
                    onChange={(e) => setValueDraft(e.target.value)}
                    onBlur={handleSaveValue}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveValue();
                      if (e.key === "Escape") setEditingValue(false);
                    }}
                    placeholder="0,00"
                    className="h-9 mt-1"
                  />
                ) : (
                  <div className="flex items-center gap-1 mt-1">
                    <button
                      type="button"
                      onClick={() => setEditingValue(true)}
                      className="text-base font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      {formatBRL(deal.value_cents)}
                    </button>
                    {deal.value_cents != null && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copy(formatBRL(deal.value_cents), "value")}
                      >
                        {copied === "value" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Prioridade</Label>
                <Select value={deal.priority} onValueChange={handlePriorityChange}>
                  <SelectTrigger className="h-9 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Estágio</Label>
              <Select value={deal.stage_id} onValueChange={handleStageChange}>
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        {s.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cliente */}
            <section className="space-y-2 rounded-lg border bg-muted/20 p-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <User className="h-3 w-3" /> Cliente
              </h3>
              <div className="space-y-1.5">
                <p className="text-sm font-medium">
                   {contactName || "Sem nome"}
                </p>
                {phone ? (
                  <div className="flex items-center gap-1.5 text-sm">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{phoneFormatted}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => copy(phoneFormatted, "phone")}
                    >
                      {copied === "phone" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Vincule um contato para usar WhatsApp e agendamento
                  </p>
                )}

                <div className="pt-2">
                  <Label className="text-xs text-muted-foreground">Tags / Etiquetas</Label>
                  <div className="mt-1">
                    <TagInput
                      tags={deal.tags || []}
                      onChange={(next) => onUpdate(deal.id, { tags: next } as any)}
                      extraSuggestions={availableTags}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-1">
                <AssigneeSelector
                  value={(deal as any).assigned_to ?? null}
                  onChange={handleAssigneeChange}
                  label="Responsável"
                  compact
                />
              </div>
            </section>

            {/* Última conversa */}
            {related?.lastMessage && (
              <section className="rounded-lg border p-3 space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" /> Última mensagem
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  <span className="font-medium text-foreground">
                    {related.lastMessage.from_me ? "Você: " : "Cliente: "}
                  </span>
                  {related.lastMessage.content || "(sem texto)"}
                </p>
                {related.lastMessage.timestamp && (
                  <p className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(related.lastMessage.timestamp), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                )}
                <Button variant="outline" size="sm" className="w-full" onClick={handleWhatsApp}>
                  <ExternalLink className="h-3 w-3 mr-1" /> Ver conversa completa
                </Button>
              </section>
            )}

            {/* Próximo agendamento */}
            <section className="rounded-lg border p-3 space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Próximo agendamento
              </h3>
              {related?.nextAppointment ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm min-w-0">
                    <p className="font-medium truncate">{related.nextAppointment.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(related.nextAppointment.appointment_date + "T00:00:00"), "dd/MM/yyyy")}
                      {" às "}
                      {related.nextAppointment.appointment_time?.slice(0, 5)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      onOpenChange(false);
                      navigate("/appointments");
                    }}
                  >
                    Ver
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">Nenhum agendamento futuro</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSchedule}
                    disabled={!phoneNormalized}
                  >
                    Agendar
                  </Button>
                </div>
              )}
            </section>

            {/* Anotações + Histórico */}
            <section className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Anotações e histórico
              </h3>
              <DealActivityTimeline dealId={deal.id} />
            </section>

            {/* Detalhes recolhíveis */}
            <section className="border-t pt-3">
              <button
                type="button"
                onClick={() => setShowDetails((s) => !s)}
                className="flex w-full items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground"
              >
                <span>Detalhes</span>
                {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              {showDetails && (
                <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                  {deal.description && (
                    <p className="whitespace-pre-wrap text-foreground">{deal.description}</p>
                  )}
                  {deal.expected_close_date && (
                    <p>
                      <strong>Previsão de fechamento:</strong>{" "}
                      {format(new Date(deal.expected_close_date + "T00:00:00"), "dd/MM/yyyy")}
                    </p>
                  )}
                  <p>
                    <strong>Criado:</strong>{" "}
                    {formatDistanceToNow(new Date(deal.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                  <p>
                    <strong>Atualizado:</strong>{" "}
                    {formatDistanceToNow(new Date(deal.updated_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              )}
            </section>
          </div>

          {/* Footer */}
          <div className="border-t px-5 py-3 flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
            </Button>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Lost reason dialog */}
      <AlertDialog open={lostOpen} onOpenChange={setLostOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar como perdido</AlertDialogTitle>
            <AlertDialogDescription>
              Conte rapidamente o motivo — isso ajuda a aprender com cada negócio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            placeholder="Ex: preço, sem retorno, escolheu concorrente..."
            className="my-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmLost}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir negócio?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todas as anotações e histórico também serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                onDelete(deal.id);
                setDeleteOpen(false);
                onOpenChange(false);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Schedule dialog */}
      <AppointmentDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        defaultDate={new Date()}
        defaultPhone={phoneFormatted || phone || ""}
        defaultContactName={contactName || ""}
        defaultAssignedTo={(deal as any).assigned_to ?? null}
        isSubmitting={createAppointment.isPending}
        onSubmit={async (data) => {
          // Pre-fill from deal
          const payload = {
            ...data,
            phone: data.phone || phone || "",
            contact_name: data.contact_name || deal.contact_name || null,
            assigned_to: data.assigned_to ?? (deal as any).assigned_to ?? null,
          };
          await createAppointment.mutateAsync(payload);
          if (user) {
            await logDealActivity(
              deal.id,
              user.id,
              "appointment_created",
              `Agendamento criado: ${payload.title} em ${payload.appointment_date} às ${payload.appointment_time}`
            );
          }
        }}
      />
    </>
  );
}