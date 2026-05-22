import { Component, lazy, Suspense, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";

// Páginas públicas leves carregadas eagerly para entrada rápida
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/Dashboard";

// Restante: code-splitting via React.lazy (reduz bundle inicial — crítico em mobile/3G)
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ForceChangePassword = lazy(() => import("./pages/ForceChangePassword"));
const WhatsApp = lazy(() => import("./pages/WhatsApp"));
const AIAgent = lazy(() => import("./pages/AIAgent"));
const SimulateAttendance = lazy(() => import("./pages/SimulateAttendance"));
const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase"));
const Conversations = lazy(() => import("./pages/Conversations"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Appointments = lazy(() => import("./pages/Appointments"));
const AppointmentSettings = lazy(() => import("./pages/AppointmentSettings"));
const Settings = lazy(() => import("./pages/Settings"));
const Subscriptions = lazy(() => import("./pages/Subscriptions"));
const CRM = lazy(() => import("./pages/CRM"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Support = lazy(() => import("./pages/Support"));
const Investors = lazy(() => import("./pages/Investors"));
const Investment = lazy(() => import("./pages/Investment"));
const HelpCenter = lazy(() => import("./pages/HelpCenter"));
const HelpCategory = lazy(() => import("./pages/HelpCategory"));
const HelpArticle = lazy(() => import("./pages/HelpArticle"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Followup = lazy(() => import("./pages/Followup"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const IgreenTrial = lazy(() => import("./pages/IgreenTrial"));
const AcademiasLanding = lazy(() => import("./pages/AcademiasLanding"));

// Admin pages (lazy)
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminLogs = lazy(() => import("./pages/admin/AdminLogs"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminSystemWhatsApp = lazy(() => import("./pages/AdminSystemWhatsApp"));
const AdminConversations = lazy(() => import("./pages/admin/AdminConversations"));
const AdminAIConfig = lazy(() => import("./pages/admin/AdminAIConfig"));
const AdminSupport = lazy(() => import("./pages/admin/AdminSupport"));
const AdminTutorialVideos = lazy(() => import("./pages/admin/AdminTutorialVideos"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"));
const AdminCRM = lazy(() => import("./pages/admin/AdminCRM"));
const AdminVoiceCosts = lazy(() => import("./pages/admin/AdminVoiceCosts"));
const AdminCreditsManager = lazy(() => import("./pages/admin/AdminCreditsManager"));
const AdminSupportCalendar = lazy(() => import("./pages/admin/AdminSupportCalendar"));
const AdminHelpCenter = lazy(() => import("./pages/admin/AdminHelpCenter"));
const AdminTasks = lazy(() => import("./pages/admin/AdminTasks"));
const AdminPlans = lazy(() => import("./pages/admin/AdminPlans"));
const AdminAICosts = lazy(() => import("./pages/admin/AdminAICosts"));
const AdminSimulateSupport = lazy(() => import("./pages/admin/AdminSimulateSupport"));
const AdminFlows = lazy(() => import("./pages/admin/AdminFlows"));
const AdminFlowEditor = lazy(() => import("./pages/admin/AdminFlowEditor"));
const AdminTrialFollowup = lazy(() => import("./pages/admin/AdminTrialFollowup"));

const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="h-10 w-10 animate-spin rounded-full border-2 border-muted border-t-primary" />
  </div>
);

class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[App] render failed", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-center">
        <div className="max-w-sm space-y-4">
          <h1 className="text-xl font-bold text-foreground">Não foi possível carregar a tela</h1>
          <p className="text-sm text-muted-foreground">
            Recarregue a página para atualizar os arquivos do Theo IA.
          </p>
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={() => window.location.reload()}
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark">
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ImpersonationBanner />
            <InstallPrompt />
            <AppErrorBoundary>
            <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/igreen-trial" element={<IgreenTrial />} />
              <Route path="/academias" element={<AcademiasLanding />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/force-change-password" element={<ForceChangePassword />} />
              <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/whatsapp" element={<ProtectedRoute><WhatsApp /></ProtectedRoute>} />
              <Route path="/ai-agent" element={<ProtectedRoute><AIAgent /></ProtectedRoute>} />
              <Route path="/followup" element={<ProtectedRoute><Followup /></ProtectedRoute>} />
              <Route path="/simulate-attendance" element={<ProtectedRoute><SimulateAttendance /></ProtectedRoute>} />
              <Route path="/knowledge-base" element={<ProtectedRoute><KnowledgeBase /></ProtectedRoute>} />
              <Route path="/conversations" element={<ProtectedRoute><Conversations /></ProtectedRoute>} />
              <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
              <Route path="/appointments" element={<ProtectedRoute><Appointments /></ProtectedRoute>} />
              <Route path="/appointment-settings" element={<ProtectedRoute><AppointmentSettings /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/subscriptions" element={<ProtectedRoute><Subscriptions /></ProtectedRoute>} />
              <Route path="/crm" element={<ProtectedRoute><CRM /></ProtectedRoute>} />
              <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
              {/* <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} /> */}{/* Oculto temporariamente */}
              <Route path="/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
              <Route path="/investors" element={<Investors />} />
              <Route path="/investment" element={<Investment />} />
              <Route path="/help-center" element={<ProtectedRoute><HelpCenter /></ProtectedRoute>} />
              <Route path="/help-center/:categorySlug" element={<ProtectedRoute><HelpCategory /></ProtectedRoute>} />
              <Route path="/help-center/:categorySlug/:articleSlug" element={<ProtectedRoute><HelpArticle /></ProtectedRoute>} />

              {/* Admin Panel */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/system-whatsapp" element={<AdminSystemWhatsApp />} />
              <Route path="/admin/conversations" element={<AdminConversations />} />
              <Route path="/admin/ai-config" element={<AdminAIConfig />} />
              <Route path="/admin/simulate-support" element={<AdminSimulateSupport />} />
              <Route path="/admin/support" element={<AdminSupport />} />
              <Route path="/admin/tutorial-videos" element={<AdminTutorialVideos />} />
              <Route path="/admin/notifications" element={<AdminNotifications />} />
              <Route path="/admin/logs" element={<AdminLogs />} />
              <Route path="/admin/crm" element={<AdminCRM />} />
              <Route path="/admin/tasks" element={<AdminTasks />} />
              <Route path="/admin/voice-costs" element={<AdminVoiceCosts />} />
              <Route path="/admin/credits" element={<AdminCreditsManager />} />
              <Route path="/admin/support-calendar" element={<AdminSupportCalendar />} />
              <Route path="/admin/help-center" element={<AdminHelpCenter />} />
              <Route path="/admin/plans" element={<AdminPlans />} />
              <Route path="/admin/ai-costs" element={<AdminAICosts />} />
              <Route path="/admin/flows" element={<AdminFlows />} />
              <Route path="/admin/flows/:id" element={<AdminFlowEditor />} />
              <Route path="/admin/trial-followup" element={<AdminTrialFollowup />} />
              <Route path="/admin" element={<AdminLogin />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            </AppErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
