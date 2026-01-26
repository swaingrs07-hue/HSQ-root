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
import VisitorLogin from "@/pages/visitor-login";
import AdminLogin from "@/pages/admin-login";
import AdminDashboard from "@/pages/admin-dashboard";

function AppContent() {
  const [location] = useLocation();
  
  const isLoginPage = location === "/login" || location === "/admin/login";

  return (
    <Switch>
      <Route path="/login" component={VisitorLogin} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route>
        {isLoginPage ? null : (
          <Layout>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/student/register" component={StudentRegistration} />
              <Route path="/properties" component={PropertySelection} />
              <Route path="/payment-plans" component={PaymentPlans} />
              <Route path="/payment-gateway" component={PaymentGateway} />
              <Route path="/agreement" component={Agreement} />
              <Route path="/admin" component={AdminDashboard} />
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
