import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import { AdminLayout } from "@/components/admin-layout";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { AuthGuardProvider } from "@/contexts/auth-guard-context";
import { PropertyProvider } from "@/contexts/property-context";
import Home from "@/pages/home";
import StudentRegistration from "@/pages/student-registration";
import PropertySelection from "@/pages/property-selection";
import PaymentPlans from "@/pages/payment-plans";
import PaymentGateway from "@/pages/payment-gateway";
import Agreement from "@/pages/agreement";
import AuthPage from "@/pages/auth";
import AdminDashboard from "@/pages/admin-dashboard";
import UserDashboard from "@/pages/user-dashboard";
import LeadAnalytics from "@/pages/lead-analytics";
import AdminLeads from "@/pages/admin-leads";
import AddProperty from "@/pages/add-property";
import AdminSalesManagement from "@/pages/admin-sales-management";
import SalesDashboard from "@/pages/sales-dashboard";
import BookingGeneration from "@/pages/booking-generation";
import RequestsBoard from "@/pages/requests-board";
import Profile from "@/pages/profile";
import Settings from "@/pages/settings";
import Help from "@/pages/help";
import AdminSettings from "@/pages/admin-settings";
import AdminUsers from "@/pages/admin-users";
import AdminActivityLogs from "@/pages/admin-activity-logs";
import AdminPropertyTourImages from "@/pages/admin-property-tour-images";
import AdminChatbot from "@/pages/admin-chatbot";
import { ChatbotWidget } from "@/components/chatbot-widget";

function AppContent() {
  const [location] = useLocation();
  const { user, isAdmin } = useAuth();
  
  const isAuthPage = location === "/auth" || location === "/login" || location === "/admin/login";
  const isAdminRoute = location.startsWith("/admin") || location.startsWith("/sales") || location === "/booking/generate";
  const isSalesExec = user?.role === "sales_executive";
  const useAdminLayout = (isAdmin || isSalesExec) && isAdminRoute;

  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/login" component={AuthPage} />
      <Route path="/admin/login" component={AuthPage} />
      <Route>
        {isAuthPage ? null : useAdminLayout ? (
          <AdminLayout>
            <Switch>
              <Route path="/admin" component={AdminDashboard} />
              <Route path="/admin/add-property" component={AddProperty} />
              <Route path="/admin/leads" component={AdminLeads} />
              <Route path="/admin/lead-analytics" component={LeadAnalytics} />
              <Route path="/admin/sales-management" component={AdminSalesManagement} />
              <Route path="/admin/booking/generate" component={BookingGeneration} />
              <Route path="/admin/requests" component={RequestsBoard} />
              <Route path="/admin/settings" component={AdminSettings} />
              <Route path="/admin/users" component={AdminUsers} />
              <Route path="/admin/activity-logs" component={AdminActivityLogs} />
              <Route path="/admin/property-tour-images" component={AdminPropertyTourImages} />
              <Route path="/admin/ai-chatbot" component={AdminChatbot} />
              <Route path="/admin/profile" component={Profile} />
              <Route path="/profile" component={Profile} />
              <Route path="/settings" component={Settings} />
              <Route path="/help" component={Help} />
              <Route path="/sales" component={SalesDashboard} />
              <Route path="/sales/requests" component={RequestsBoard} />
              <Route path="/booking/generate" component={BookingGeneration} />
              <Route path="/properties" component={PropertySelection} />
              <Route component={NotFound} />
            </Switch>
          </AdminLayout>
        ) : (
          <Layout>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/dashboard" component={UserDashboard} />
              <Route path="/student/register" component={StudentRegistration} />
              <Route path="/properties" component={PropertySelection} />
              <Route path="/payment-plans" component={PaymentPlans} />
              <Route path="/payment-gateway" component={PaymentGateway} />
              <Route path="/agreement" component={Agreement} />
              <Route path="/booking/generate" component={BookingGeneration} />
              <Route path="/profile" component={Profile} />
              <Route path="/settings" component={Settings} />
              <Route path="/help" component={Help} />
              <Route component={NotFound} />
            </Switch>
            <ChatbotWidget />
          </Layout>
        )}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AuthProvider>
          <AuthGuardProvider>
            <PropertyProvider>
              <AppContent />
            </PropertyProvider>
          </AuthGuardProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
