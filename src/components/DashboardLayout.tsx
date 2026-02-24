import { ReactNode, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Menu, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

export function DashboardLayout({ children, title, description }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full">
      {/* Sidebar Desktop - CSS-first: hidden em mobile, block em lg+ */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <div className="flex flex-1 flex-col">
        {/* Header Mobile com Hambúrguer - CSS-first: visível até lg */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4 lg:hidden">
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
          <h1 className="text-lg font-semibold truncate">{title}</h1>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="container py-4 md:py-6">
            {/* Título desktop - hidden em mobile, block em lg+ */}
            <div className="mb-6 hidden lg:block">
              <h1 className="text-2xl font-bold text-foreground">{title}</h1>
              {description && (
                <p className="text-muted-foreground">{description}</p>
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
        href="https://wa.me/5547984863023"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-20 right-6 z-50 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-white shadow-lg transition-transform hover:scale-105"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="hidden sm:inline text-sm font-medium">Suporte</span>
      </a>
    </div>
  );
}
