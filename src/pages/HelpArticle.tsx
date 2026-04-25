import { Link, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";
import { useHelpArticle } from "@/hooks/useHelpCenter";
import { HelpArticleView } from "@/components/help/HelpArticleView";

const SUPPORT_PHONE = "5547991293662";
const SUPPORT_MSG = encodeURIComponent("Olá! Preciso de ajuda com o Theo IA.");

export default function HelpArticle() {
  const { categorySlug, articleSlug } = useParams();
  const { data, isLoading } = useHelpArticle(categorySlug, articleSlug);

  if (isLoading) {
    return (
      <DashboardLayout title="Carregando...">
        <Card className="h-64 animate-pulse" />
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout title="Artigo não encontrado">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Este artigo não existe ou foi removido.</p>
          <Button asChild className="mt-4">
            <Link to="/help-center">Voltar à Central de Ajuda</Link>
          </Button>
        </Card>
      </DashboardLayout>
    );
  }

  const { category, article, images, prev, next } = data;

  return (
    <DashboardLayout title={article.title} description={article.summary ?? undefined}>
      <div className="mx-auto max-w-3xl space-y-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to={`/help-center/${category.slug}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {category.name}
          </Link>
        </Button>

        <Card className="p-6 md:p-8">
          <HelpArticleView content={article.content} images={images} />
        </Card>

        <div className="grid gap-3 sm:grid-cols-2">
          {prev ? (
            <Button asChild variant="outline" className="justify-start h-auto py-3">
              <Link to={`/help-center/${category.slug}/${prev.slug}`}>
                <ChevronLeft className="h-4 w-4 mr-2 shrink-0" />
                <div className="text-left min-w-0">
                  <p className="text-xs text-muted-foreground">Anterior</p>
                  <p className="text-sm font-medium truncate">{prev.title}</p>
                </div>
              </Link>
            </Button>
          ) : (
            <div />
          )}
          {next ? (
            <Button asChild variant="outline" className="justify-end h-auto py-3 sm:col-start-2">
              <Link to={`/help-center/${category.slug}/${next.slug}`}>
                <div className="text-right min-w-0">
                  <p className="text-xs text-muted-foreground">Próximo</p>
                  <p className="text-sm font-medium truncate">{next.title}</p>
                </div>
                <ChevronRight className="h-4 w-4 ml-2 shrink-0" />
              </Link>
            </Button>
          ) : null}
        </div>

        <Card className="p-5 bg-muted/30">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-medium">Ainda com dúvidas?</p>
              <p className="text-sm text-muted-foreground">
                Fale com nosso suporte pelo WhatsApp.
              </p>
            </div>
            <Button asChild className="bg-[#25D366] hover:bg-[#1ebe5a] text-white">
              <a
                href={`https://wa.me/${SUPPORT_PHONE}?text=${SUPPORT_MSG}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Falar com suporte
              </a>
            </Button>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}