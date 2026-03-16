import { useState } from "react";
import { Search, Filter, X, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export interface CRMFilterState {
  search: string;
  priorities: string[];
  tags: string[];
  minValue: number;
  maxValue: number;
}

const EMPTY_FILTERS: CRMFilterState = {
  search: "",
  priorities: [],
  tags: [],
  minValue: 0,
  maxValue: 0,
};

interface CRMFiltersProps {
  filters: CRMFilterState;
  onChange: (filters: CRMFilterState) => void;
  availableTags: string[];
  maxDealValue: number;
}

const PRIORITIES = [
  { value: "high", label: "Alta", color: "bg-destructive/10 text-destructive" },
  { value: "medium", label: "Média", color: "bg-warning/10 text-warning" },
  { value: "low", label: "Baixa", color: "bg-muted text-muted-foreground" },
];

export function CRMFilters({ filters, onChange, availableTags, maxDealValue }: CRMFiltersProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeCount =
    filters.priorities.length +
    filters.tags.length +
    (filters.minValue > 0 || filters.maxValue > 0 ? 1 : 0);

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

  const togglePriority = (p: string) => {
    const next = filters.priorities.includes(p)
      ? filters.priorities.filter((x) => x !== p)
      : [...filters.priorities, p];
    onChange({ ...filters, priorities: next });
  };

  const toggleTag = (t: string) => {
    const next = filters.tags.includes(t)
      ? filters.tags.filter((x) => x !== t)
      : [...filters.tags, t];
    onChange({ ...filters, tags: next });
  };

  const clearFilters = () => onChange(EMPTY_FILTERS);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por título ou contato..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="pl-9 h-9"
        />
        {filters.search && (
          <button
            onClick={() => onChange({ ...filters, search: "" })}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-1.5">
            <Filter className="h-3.5 w-3.5" />
            Filtros
            {activeCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                {activeCount}
              </Badge>
            )}
            <ChevronDown className="h-3 w-3 ml-0.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-4" align="start">
          <div className="space-y-4">
            {/* Prioridade */}
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prioridade</Label>
              <div className="flex gap-2 mt-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => togglePriority(p.value)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium border transition-all",
                      filters.priorities.includes(p.value)
                        ? `${p.color} border-current ring-1 ring-current/20`
                        : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            {availableTags.length > 0 && (
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tags</Label>
                <div className="flex flex-wrap gap-1.5 mt-2 max-h-24 overflow-y-auto">
                  {availableTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs border transition-all",
                        filters.tags.includes(tag)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                      )}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Valor */}
            {maxDealValue > 0 && (
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Valor mínimo
                </Label>
                <Slider
                  className="mt-3"
                  min={0}
                  max={maxDealValue}
                  step={Math.max(100, Math.floor(maxDealValue / 100))}
                  value={[filters.minValue]}
                  onValueChange={([v]) => onChange({ ...filters, minValue: v })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {filters.minValue > 0 ? `A partir de ${formatCurrency(filters.minValue)}` : "Sem filtro de valor"}
                </p>
              </div>
            )}

            {activeCount > 0 && (
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={clearFilters}>
                <X className="h-3 w-3 mr-1" /> Limpar filtros
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Active filter badges */}
      {activeCount > 0 && (
        <div className="flex gap-1 flex-wrap">
          {filters.priorities.map((p) => (
            <Badge key={p} variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => togglePriority(p)}>
              {PRIORITIES.find((x) => x.value === p)?.label}
              <X className="h-2.5 w-2.5" />
            </Badge>
          ))}
          {filters.tags.map((t) => (
            <Badge key={t} variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => toggleTag(t)}>
              {t}
              <X className="h-2.5 w-2.5" />
            </Badge>
          ))}
          {filters.minValue > 0 && (
            <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => onChange({ ...filters, minValue: 0 })}>
              ≥ {formatCurrency(filters.minValue)}
              <X className="h-2.5 w-2.5" />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

export function useFilteredDeals(deals: any[], filters: CRMFilterState) {
  if (!filters.search && !filters.priorities.length && !filters.tags.length && !filters.minValue) {
    return deals;
  }

  return deals.filter((deal) => {
    // Search
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const matchTitle = deal.title?.toLowerCase().includes(q);
      const matchContact = deal.contact_name?.toLowerCase().includes(q) || deal.contact_phone?.includes(q);
      if (!matchTitle && !matchContact) return false;
    }

    // Priority
    if (filters.priorities.length && !filters.priorities.includes(deal.priority)) return false;

    // Tags
    if (filters.tags.length && !filters.tags.some((t: string) => deal.tags?.includes(t))) return false;

    // Value
    if (filters.minValue > 0 && (deal.value_cents == null || deal.value_cents < filters.minValue)) return false;

    return true;
  });
}
