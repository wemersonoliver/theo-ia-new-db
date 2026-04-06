import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import WhatsApp from "./pages/WhatsApp";
import AIAgent from "./pages/AIAgent";
import KnowledgeBase from "./pages/KnowledgeBase";
import Conversations from "./pages/Conversations";
import Contacts from "./pages/Contacts";
import Appointments from "./pages/Appointments";
import AppointmentSettings from "./pages/AppointmentSettings";
import Settings from "./pages/Settings";
import Subscriptions from "./pages/Subscriptions";
import NotFound from "./pages/NotFound";
import CRM from "./pages/CRM";
import Products from "./pages/Products";
import LandingPage from "./pages/LandingPage";
import Onboarding from "./pages/Onboarding";
import Support from "./pages/Support";

// Admin pages
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminLogs from "./pages/admin/AdminLogs";
import AdminUsers from "./pages/AdminUsers";
import AdminSystemWhatsApp from "./pages/AdminSystemWhatsApp";
import AdminConversations from "./pages/admin/AdminConversations";
import AdminAIConfig from "./pages/admin/AdminAIConfig";
import AdminSupport from "./pages/admin/AdminSupport";
import AdminTutorialVideos from "./pages/admin/AdminTutorialVideos";
import AdminNotifications from "./pages/admin/AdminNotifications";
import AdminCRM from "./pages/admin/AdminCRM";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/whatsapp" element={<ProtectedRoute><WhatsApp /></ProtectedRoute>} />
              <Route path="/ai-agent" element={<ProtectedRoute><AIAgent /></ProtectedRoute>} />
              <Route path="/knowledge-base" element={<ProtectedRoute><KnowledgeBase /></ProtectedRoute>} />
              <Route path="/conversations" element={<ProtectedRoute><Conversations /></ProtectedRoute>} />
              <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
              <Route path="/appointments" element={<ProtectedRoute><Appointments /></ProtectedRoute>} />
              <Route path="/appointment-settings" element={<ProtectedRoute><AppointmentSettings /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/subscriptions" element={<ProtectedRoute><Subscriptions /></ProtectedRoute>} />
              <Route path="/crm" element={<ProtectedRoute><CRM /></ProtectedRoute>} />
              {/* <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} /> */}{/* Oculto temporariamente */}
              <Route path="/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />

              {/* Admin Panel */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/system-whatsapp" element={<AdminSystemWhatsApp />} />
              <Route path="/admin/conversations" element={<AdminConversations />} />
              <Route path="/admin/ai-config" element={<AdminAIConfig />} />
              <Route path="/admin/support" element={<AdminSupport />} />
              <Route path="/admin/tutorial-videos" element={<AdminTutorialVideos />} />
              <Route path="/admin/notifications" element={<AdminNotifications />} />
              <Route path="/admin/logs" element={<AdminLogs />} />
              <Route path="/admin/crm" element={<AdminCRM />} />
              <Route path="/admin" element={<AdminLogin />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
