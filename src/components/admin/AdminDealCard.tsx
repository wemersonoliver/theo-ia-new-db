import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AdminCRMDeal } from "@/hooks/useAdminCRMDeals";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { GripVertical, Mail, Phone, CheckCircle2, XCircle, CreditCard, Bot, BotOff, Smartphone } from "lucide-react";

interface AdminDealCardProps {
  deal: AdminCRMDeal;
  onClick: (deal: AdminCRMDeal) => void;
}

export function AdminDealCard({ deal, onClick }: AdminDealCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
    data: { type: "deal", deal },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const daysInStage = Math.floor(
    (Date.now() - new Date(deal.updated_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  const subStatusLabel: Record<string, { label: string; class: string }> = {
    active: { label: "Ativo", class: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    trial: { label: "Trial", class: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
    tester: { label: "Tester", class: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
    inactive: { label: "Inativo", class: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
    cancelled: { label: "Cancelado", class: "bg-red-500/20 text-red-400 border-red-500/30" },
  };

  const sub = deal.subscription_status ? subStatusLabel[deal.subscription_status] || subStatusLabel.inactive : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group rounded-lg border border-slate-700/50 bg-slate-800/80 p-3 shadow-sm transition-all hover:border-slate-600 hover:shadow-md cursor-pointer",
        isDragging && "opacity-50 shadow-lg rotate-2"
      )}
      onClick={() => onClick(deal)}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-slate-300"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-slate-100 truncate">{deal.title}</p>

          {deal.user_email && (
            <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
              <Mail className="h-3 w-3" />
              <span className="truncate">{deal.user_email}</span>
            </div>
          )}

          {deal.user_phone && (
            <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-400">
              <Phone className="h-3 w-3" />
              <span className="truncate">{deal.user_phone}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {/* Onboarding status */}
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0 gap-0.5",
                deal.onboarding_completed
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-orange-500/10 text-orange-400 border-orange-500/30"
              )}
            >
              {deal.onboarding_completed ? (
                <><CheckCircle2 className="h-2.5 w-2.5" /> Onboarding</>
              ) : (
                <><XCircle className="h-2.5 w-2.5" /> Pendente</>
              )}
            </Badge>

            {/* Subscription */}
            {sub && (
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 gap-0.5", sub.class)}>
                <CreditCard className="h-2.5 w-2.5" />
                {sub.label}
                {deal.subscription_plan && ` · ${deal.subscription_plan}`}
              </Badge>
            )}

            {/* Support AI status — sempre visível quando há usuário vinculado */}
            {deal.user_ref_id && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] px-1.5 py-0 gap-0.5",
                  deal.support_ai_active !== false
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    : "bg-slate-500/10 text-slate-400 border-slate-500/30"
                )}
              >
                {deal.support_ai_active !== false ? (
                  <><Bot className="h-2.5 w-2.5" /> IA ativa</>
                ) : (
                  <><BotOff className="h-2.5 w-2.5" /> IA off</>
                )}
              </Badge>
            )}

            {/* WhatsApp status — sempre visível quando há usuário vinculado */}
            {deal.user_ref_id && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] px-1.5 py-0 gap-0.5",
                  deal.whatsapp_status === "connected" || deal.whatsapp_status === "open"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-red-500/10 text-red-400 border-red-500/30"
                )}
              >
                <Smartphone className="h-2.5 w-2.5" />
                {deal.whatsapp_status === "connected" || deal.whatsapp_status === "open"
                  ? "WhatsApp"
                  : "WhatsApp off"}
              </Badge>
            )}

            {daysInStage > 0 && (
              <span className={cn("text-[10px]", daysInStage > 7 ? "text-red-400" : "text-slate-500")}>
                {daysInStage}d
              </span>
            )}

            {deal.tags?.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 bg-slate-700 text-slate-300 border-slate-600">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
