import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search } from "lucide-react";
import { Link } from "react-router-dom";
import { HelpCategoryCard } from "@/components/help/HelpCategoryCard";
import {
  useHelpCategories,
  useHelpCategoryArticleCounts,
  useHelpSearch,
} from "@/hooks/useHelpCenter";

export default function HelpCenter() {
  const [q, setQ] = useState("");
  const { data: categories, isLoading } = useHelpCategories();
  const { data: counts } = useHelpCategoryArticleCounts();
  const { data: searchResults } = useHelpSearch(q);

  const categoriesById = new Map((categories ?? []).map((c) => [c.id, c]));

  return (
    <DashboardLayout
      title="Central de Ajuda"
      description="Tutoriais passo a passo para você dominar a plataforma."
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar tutorial... (ex: WhatsApp, agendamento)"
            className="pl-9 h-11"
          />
        </div>

        {q.trim().length >= 2 ? (
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              Resultados ({searchResults?.length ?? 0})
            </h2>
            {searchResults && searchResults.length > 0 ? (
              <div className="space-y-2">
                {searchResults.map((r) => {
                  const cat = categoriesById.get(r.category_id);
                  if (!cat) return null;
                  return (
                    <Link
                      key={r.id}
                      to={`/help-center/${cat.slug}/${r.slug}`}
                      className="block"
                    >
                      <Card className="p-4 hover:border-primary transition-colors">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          {cat.name}
                        </p>
                        <h3 className="font-semibold mt-1">{r.title}</h3>
                        {r.summary && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {r.summary}
                          </p>
                        )}
                      </Card>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <Card className="p-8 text-center text-muted-foreground">
                Nenhum resultado para "{q}".
              </Card>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="h-28 animate-pulse" />
                ))
              : categories?.map((c) => (
                  <HelpCategoryCard
                    key={c.id}
                    category={c}
                    count={counts?.[c.id] ?? 0}
                  />
                ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}