import { Link, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useHelpArticlesByCategory } from "@/hooks/useHelpCenter";

export default function HelpCategory() {
  const { categorySlug } = useParams();
  const { data, isLoading } = useHelpArticlesByCategory(categorySlug);

  return (
    <DashboardLayout
      title={data?.category?.name ?? "Categoria"}
      description={data?.category?.description ?? undefined}
    >
      <div className="mx-auto max-w-3xl space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/help-center">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Todas as categorias
          </Link>
        </Button>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="h-20 animate-pulse" />
            ))}
          </div>
        ) : data?.articles.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            Ainda não há tutoriais publicados nesta categoria.
          </Card>
        ) : (
          <div className="space-y-2">
            {data?.articles.map((a) => (
              <Link key={a.id} to={`/help-center/${categorySlug}/${a.slug}`}>
                <Card className="p-4 hover:border-primary transition-colors flex items-start gap-3 group">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold leading-snug">{a.title}</h3>
                    {a.summary && (
                      <p className="text-sm text-muted-foreground mt-1">{a.summary}</p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary mt-1 shrink-0" />
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}