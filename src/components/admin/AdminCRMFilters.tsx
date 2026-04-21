import { useState } from "react";
import { Search, Filter, X, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import type { AdminCRMDeal } from "@/hooks/useAdminCRMDeals";

export interface AdminCRMFilterState {
  search: string;
  subscriptionActive: "any" | "yes" | "no";
  onboardingCompleted: "any" | "yes" | "no";
  whatsappStatus: "any" | "on" | "off";
  registeredFrom: Date | null;
  registeredTo: Date | null;
}

export const EMPTY_ADMIN_FILTERS: AdminCRMFilterState = {
  search: "",
  subscriptionActive: "any",
  onboardingCompleted: "any",
  whatsappStatus: "any",
  registeredFrom: null,
  registeredTo: null,
};

interface Props {
  filters: AdminCRMFilterState;
  onChange: (filters: AdminCRMFilterState) => void;
}

const TRI = [
  { value: "any", label: "Todos" },
  { value: "yes", label: "Sim" },
  { value: "no", label: "Não" },
] as const;

const WA = [
  { value: "any", label: "Todos" },
  { value: "on", label: "Conectado" },
  { value: "off", label: "Desconectado" },
] as const;

export function AdminCRMFilters({ filters, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const activeCount =
    (filters.subscriptionActive !== "any" ? 1 : 0) +
    (filters.onboardingCompleted !== "any" ? 1 : 0) +
    (filters.whatsappStatus !== "any" ? 1 : 0) +
    (filters.registeredFrom || filters.registeredTo ? 1 : 0);

  const clearFilters = () => onChange({ ...EMPTY_ADMIN_FILTERS, search: filters.search });

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <Input
          placeholder="Buscar por nome, email ou telefone..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="pl-9 h-9 bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-500"
        />
        {filters.search && (
          <button
            onClick={() => onChange({ ...filters, search: "" })}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800">
            <Filter className="h-3.5 w-3.5" />
            Filtros
            {activeCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-amber-500/20 text-amber-300">
                {activeCount}
              </Badge>
            )}
            <ChevronDown className="h-3 w-3 ml-0.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4 bg-slate-900 border-slate-700" align="start">
          <div className="space-y-4">
            <FilterGroup
              label="Assinatura ativa"
              options={TRI}
              value={filters.subscriptionActive}
              onSelect={(v) => onChange({ ...filters, subscriptionActive: v as any })}
            />
            <FilterGroup
              label="Onboarding concluído"
              options={TRI}
              value={filters.onboardingCompleted}
              onSelect={(v) => onChange({ ...filters, onboardingCompleted: v as any })}
            />
            <FilterGroup
              label="WhatsApp"
              options={WA}
              value={filters.whatsappStatus}
              onSelect={(v) => onChange({ ...filters, whatsappStatus: v as any })}
            />

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Data de cadastro</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <DateField
                  value={filters.registeredFrom}
                  onChange={(d) => onChange({ ...filters, registeredFrom: d })}
                  placeholder="De"
                />
                <DateField
                  value={filters.registeredTo}
                  onChange={(d) => onChange({ ...filters, registeredTo: d })}
                  placeholder="Até"
                />
              </div>
            </div>

            {activeCount > 0 && (
              <Button variant="ghost" size="sm" className="w-full text-xs text-slate-300 hover:text-white hover:bg-slate-800" onClick={clearFilters}>
                <X className="h-3 w-3 mr-1" /> Limpar filtros
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {activeCount > 0 && (
        <div className="flex gap-1 flex-wrap">
          {filters.subscriptionActive !== "any" && (
            <Badge variant="secondary" className="text-xs gap-1 cursor-pointer bg-slate-800 text-slate-200" onClick={() => onChange({ ...filters, subscriptionActive: "any" })}>
              Assinatura: {filters.subscriptionActive === "yes" ? "Ativa" : "Inativa"}
              <X className="h-2.5 w-2.5" />
            </Badge>
          )}
          {filters.onboardingCompleted !== "any" && (
            <Badge variant="secondary" className="text-xs gap-1 cursor-pointer bg-slate-800 text-slate-200" onClick={() => onChange({ ...filters, onboardingCompleted: "any" })}>
              Onboarding: {filters.onboardingCompleted === "yes" ? "Concluído" : "Pendente"}
              <X className="h-2.5 w-2.5" />
            </Badge>
          )}
          {filters.whatsappStatus !== "any" && (
            <Badge variant="secondary" className="text-xs gap-1 cursor-pointer bg-slate-800 text-slate-200" onClick={() => onChange({ ...filters, whatsappStatus: "any" })}>
              WA: {filters.whatsappStatus === "on" ? "On" : "Off"}
              <X className="h-2.5 w-2.5" />
            </Badge>
          )}
          {(filters.registeredFrom || filters.registeredTo) && (
            <Badge variant="secondary" className="text-xs gap-1 cursor-pointer bg-slate-800 text-slate-200" onClick={() => onChange({ ...filters, registeredFrom: null, registeredTo: null })}>
              {filters.registeredFrom ? format(filters.registeredFrom, "dd/MM/yy") : "..."} → {filters.registeredTo ? format(filters.registeredTo, "dd/MM/yy") : "..."}
              <X className="h-2.5 w-2.5" />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, options, value, onSelect }: { label: string; options: readonly { value: string; label: string }[]; value: string; onSelect: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</Label>
      <div className="flex gap-1.5 mt-2">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onSelect(o.value)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium border transition-all flex-1",
              value === o.value
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                : "bg-slate-800/50 text-slate-400 border-transparent hover:bg-slate-800"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function DateField({ value, onChange, placeholder }: { value: Date | null; onChange: (d: Date | null) => void; placeholder: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 justify-start text-left font-normal bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700",
            !value && "text-slate-500"
          )}
        >
          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
          {value ? format(value, "dd/MM/yy", { locale: ptBR }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-slate-900 border-slate-700" align="start">
        <Calendar
          mode="single"
          selected={value || undefined}
          onSelect={(d) => onChange(d || null)}
          initialFocus
          locale={ptBR}
          className={cn("p-3 pointer-events-auto")}
        />
        {value && (
          <div className="p-2 border-t border-slate-700">
            <Button variant="ghost" size="sm" className="w-full text-xs text-slate-400" onClick={() => onChange(null)}>
              Limpar
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function useFilteredAdminDeals(deals: AdminCRMDeal[], filters: AdminCRMFilterState) {
  const hasFilters =
    filters.search ||
    filters.subscriptionActive !== "any" ||
    filters.onboardingCompleted !== "any" ||
    filters.whatsappStatus !== "any" ||
    filters.registeredFrom ||
    filters.registeredTo;

  if (!hasFilters) return deals;

  return deals.filter((d) => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const matches =
        d.title?.toLowerCase().includes(q) ||
        d.user_email?.toLowerCase().includes(q) ||
        d.user_phone?.includes(q);
      if (!matches) return false;
    }

    if (filters.subscriptionActive !== "any") {
      const isActive = d.subscription_status === "active";
      if (filters.subscriptionActive === "yes" && !isActive) return false;
      if (filters.subscriptionActive === "no" && isActive) return false;
    }

    if (filters.onboardingCompleted !== "any") {
      const done = !!d.onboarding_completed;
      if (filters.onboardingCompleted === "yes" && !done) return false;
      if (filters.onboardingCompleted === "no" && done) return false;
    }

    if (filters.whatsappStatus !== "any") {
      const status = (d.whatsapp_status || "").toLowerCase();
      const isOn = status === "connected" || status === "open";
      if (filters.whatsappStatus === "on" && !isOn) return false;
      if (filters.whatsappStatus === "off" && isOn) return false;
    }

    if (filters.registeredFrom || filters.registeredTo) {
      const created = d.created_at ? new Date(d.created_at) : null;
      if (!created) return false;
      if (filters.registeredFrom && created < filters.registeredFrom) return false;
      if (filters.registeredTo) {
        const end = new Date(filters.registeredTo);
        end.setHours(23, 59, 59, 999);
        if (created > end) return false;
      }
    }

    return true;
  });
}