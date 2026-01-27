import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import { AuthProvider } from "@/contexts/auth-context";
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
import AddProperty from "@/pages/add-property";
import AdminSalesManagement from "@/pages/admin-sales-management";
import SalesDashboard from "@/pages/sales-dashboard";
import BookingGeneration from "@/pages/booking-generation";

function AppContent() {
  const [location] = useLocation();
  
  const isAuthPage = location === "/auth" || location === "/login" || location === "/admin/login";

  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/login" component={AuthPage} />
      <Route path="/admin/login" component={AuthPage} />
      <Route>
        {isAuthPage ? null : (
          <Layout>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/dashboard" component={UserDashboard} />
              <Route path="/student/register" component={StudentRegistration} />
              <Route path="/properties" component={PropertySelection} />
              <Route path="/payment-plans" component={PaymentPlans} />
              <Route path="/payment-gateway" component={PaymentGateway} />
              <Route path="/agreement" component={Agreement} />
              <Route path="/admin" component={AdminDashboard} />
              <Route path="/admin/add-property" component={AddProperty} />
              <Route path="/admin/leads" component={LeadAnalytics} />
              <Route path="/admin/sales-management" component={AdminSalesManagement} />
              <Route path="/sales" component={SalesDashboard} />
              <Route path="/booking/generate" component={BookingGeneration} />
              <Route path="/admin/booking/generate" component={BookingGeneration} />
              <Route path="/operations" component={AdminDashboard} />
              <Route component={NotFound} />
            </Switch>
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
          <AppContent />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
