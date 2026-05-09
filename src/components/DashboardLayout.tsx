import { ReactNode, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Menu, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { WhatsAppDisconnectedBanner } from "@/components/WhatsAppDisconnectedBanner";
import { AuroraBackground } from "@/components/fx/AuroraBackground";

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

export function DashboardLayout({ children, title, description }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="relative flex min-h-screen w-full">
      <AuroraBackground intensity="subtle" className="fixed" />
      {/* Sidebar Desktop - CSS-first: hidden em mobile, block em lg+ */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <div className="relative flex flex-1 flex-col min-w-0">
        {/* Header Mobile com Hambúrguer - CSS-first: visível até lg */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-border/60 bg-background px-4 lg:hidden">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Abrir menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0" hideClose>
              <Sidebar mobile onNavigate={() => setSidebarOpen(false)} />
            </SheetContent>
          </Sheet>
          <h1 className="text-lg font-display font-semibold truncate">{title}</h1>
        </header>

        <WhatsAppDisconnectedBanner />

        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <div className="container py-4 md:py-6 max-w-full">
            {/* Título desktop - hidden em mobile, block em lg+ */}
            <div className="mb-6 hidden lg:block">
              <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">
                {title}
              </h1>
              {description && (
                <p className="text-muted-foreground mt-1">{description}</p>
              )}
            </div>
            {/* Descrição mobile - visível até lg */}
            {description && (
              <p className="text-sm text-muted-foreground mb-4 lg:hidden">{description}</p>
            )}
            {children}
          </div>
        </main>
      </div>

      {/* Botão flutuante de suporte WhatsApp */}
      <a
        href="https://wa.me/5547991293662"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-20 right-6 z-50 flex items-center gap-2 rounded-full bg-[hsl(var(--neon-green))] px-4 py-3 text-white shadow-[0_0_30px_hsl(var(--neon-green)/0.5)] transition-all hover:scale-105 hover:shadow-[0_0_50px_hsl(var(--neon-green)/0.7)]"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="hidden sm:inline text-sm font-medium">Suporte</span>
      </a>
    </div>
  );
}
