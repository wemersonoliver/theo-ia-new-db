import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { HelpCategory } from "@/hooks/useHelpCenter";

interface HelpCategoryCardProps {
  category: HelpCategory;
  count: number;
}

export function HelpCategoryCard({ category, count }: HelpCategoryCardProps) {
  const Icon = ((Icons as unknown as Record<string, LucideIcon>)[category.icon] || Icons.BookOpen) as LucideIcon;

  return (
    <Link to={`/help-center/${category.slug}`} className="block group">
      <Card className="h-full p-5 hover:border-primary hover:shadow-md transition-all">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold leading-tight">{category.name}</h3>
            {category.description && (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                {category.description}
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {count} {count === 1 ? "artigo" : "artigos"}
            </p>
          </div>
        </div>
      </Card>
    </Link>
  );
}