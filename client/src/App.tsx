import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
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
import AdminCalendar from "@/pages/admin-calendar";
import AdminHeroSlides from "@/pages/admin-hero-slides";
import AdminFooterSettings from "@/pages/admin-footer-settings";
import CompletedBookings from "@/pages/completed-bookings";
import MyBookings from "@/pages/my-bookings";
import AdminDataExport from "@/pages/admin-data-export";
import AdminFloorsBeds from "@/pages/admin-floors-beds";
import AdminVirtualTour from "@/pages/admin-virtual-tour";
import AdminBookingTree from "@/pages/admin-booking-tree";
import AdminPackages from "@/pages/admin-packages";
import AdminAddonServices from "@/pages/admin-addon-services";
import AdminSeasons from "@/pages/admin-seasons";
import AdminHmsSync from "@/pages/admin-hms-sync";
import AdminLogoControl from "@/pages/admin-logo-control";
import AdminAmenities from "@/pages/admin-amenities";
import AdminMapDesign from "@/pages/admin-map-design";
import PropertyBooking from "@/pages/property-booking";
import ResetPasswordPage from "@/pages/admin-reset-password";
import AdminRegistrations from "@/pages/admin-registrations";
import AdminContactMessages from "@/pages/admin-contact-messages";
import Apply from "@/pages/apply";
import About from "@/pages/about";
import Contact from "@/pages/contact";
import FAQ from "@/pages/faq";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import CollegeLandingPage from "@/pages/college-landing";
import { ChatbotWidget } from "@/components/chatbot-widget";

const PAGE_TITLES: Record<string, string> = {
  "/": "Hsquare Hostel Mumbai | Hostel & Co-Living in Goregaon, Juhu & Andheri near NMIMS, Mithibai",
  "/properties": "Explore Properties - Student Hostels & PG in Mumbai | Hsquareliving",
  "/auth": "Login | Hsquareliving",
  "/login": "Login | Hsquareliving",
  "/admin/login": "Admin Login | Hsquareliving",
  "/student/register": "Student Registration | Hsquareliving",
  "/payment-plans": "Payment Plans | Hsquareliving",
  "/payment-gateway": "Payment | Hsquareliving",
  "/agreement": "Booking Agreement | Hsquareliving",
  "/dashboard": "My Dashboard | Hsquareliving",
  "/my-bookings": "My Bookings | Hsquareliving",
  "/profile": "Profile | Hsquareliving",
  "/settings": "Settings | Hsquareliving",
  "/help": "Help & Support | Hsquareliving",
  "/booking/generate": "Generate Booking | Hsquareliving",
  "/about": "About Us - HSquare Living | Premium Hospitality",
  "/contact": "Contact Us - Hsquare Hostel Mumbai | Get In Touch",
  "/faq": "FAQs - Hsquare Living | Frequently Asked Questions",
  "/terms": "Terms & Conditions - Hsquare Harmony Living",
  "/privacy": "Privacy Policy - Hsquare Harmony Living",
  "/apply": "Pre-Registration | Hsquare Hostel Mumbai - Student Accommodation",
  "/hostel-near-nmims": "Hostel Near NMIMS Mumbai | Hsquare Living - Student PG & Accommodation",
  "/hostel-near-mithibai": "Hostel Near Mithibai College Mumbai | Hsquare Living - Student PG",
  "/hostel-near-mukesh-patel": "Hostel Near Mukesh Patel Mumbai | Hsquare Living - Student Accommodation",
  "/hostel-near-nm-college": "Hostel Near NM College Mumbai | Hsquare Living - Student PG",
  "/hostel-near-dj-sanghvi": "Hostel Near DJ Sanghvi College Mumbai | Hsquare Living - Student PG",
  "/hostel-near-whistling-woods": "Hostel Near Whistling Woods Mumbai | Hsquare Living - Student PG",
  "/hostel-in-vile-parle": "Best Hostel in Vile Parle Mumbai | Hsquare Living - Student Accommodation",
  "/hostel-in-goregaon": "Best Hostel in Goregaon Mumbai | Hsquare Living - Student PG",
};

const SITE_URL = "https://hsquare.in";

function AppContent() {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);

    if (!location.startsWith("/properties/") || location === "/properties") {
      const title = PAGE_TITLES[location] ||
        (location.startsWith("/admin") ? "Admin Panel | Hsquareliving" :
        (location.startsWith("/sales") ? "Sales Dashboard | Hsquareliving" :
        "Hsquare Hostel Mumbai | Premium Hostel & Co-Living"));
      document.title = title;
    }

    if (!location.startsWith("/properties/") || location === "/properties") {
      const canonicalEl = document.getElementById("canonical-link") as HTMLLinkElement | null;
      if (canonicalEl) {
        canonicalEl.href = `${SITE_URL}${location === "/" ? "/" : location}`;
      }
    }
  }, [location]);
  const { user, isAdmin } = useAuth();
  
  const isResetPasswordPage = location.startsWith("/admin/reset-password") || location.startsWith("/reset-password");
  const isAuthPage = location === "/auth" || location === "/login" || location === "/admin/login" || isResetPasswordPage;
  const isSalesExec = user?.role === "sales_executive";
  const isReceptionist = user?.role === "receptionist";
  const isAdminRoute = !isResetPasswordPage && (location.startsWith("/admin") || location.startsWith("/sales") || location === "/booking/generate" || ((isSalesExec || isAdmin || isReceptionist) && (location === "/profile" || location === "/settings" || location === "/help")));
  const useAdminLayout = (isAdmin || isSalesExec || isReceptionist) && isAdminRoute;

  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/login" component={AuthPage} />
      <Route path="/admin/login" component={AuthPage} />
      <Route path="/admin/reset-password" component={ResetPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
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
              <Route path="/admin/bookings/completed" component={CompletedBookings} />
              <Route path="/admin/requests" component={RequestsBoard} />
              <Route path="/admin/settings" component={AdminSettings} />
              <Route path="/admin/users" component={AdminUsers} />
              <Route path="/admin/activity-logs" component={AdminActivityLogs} />
              <Route path="/admin/property-tour-images" component={AdminPropertyTourImages} />
              <Route path="/admin/ai-chatbot" component={AdminChatbot} />
              <Route path="/admin/hero-slides" component={AdminHeroSlides} />
              <Route path="/admin/footer-settings" component={AdminFooterSettings} />
              <Route path="/admin/calendar" component={AdminCalendar} />
              <Route path="/admin/floors-beds" component={AdminFloorsBeds} />
              <Route path="/admin/booking-tree" component={AdminBookingTree} />
              <Route path="/admin/virtual-tour-uploads" component={AdminVirtualTour} />
              <Route path="/admin/packages" component={AdminPackages} />
              <Route path="/admin/addon-services" component={AdminAddonServices} />
              <Route path="/admin/seasons" component={AdminSeasons} />
              <Route path="/admin/hms-sync" component={AdminHmsSync} />
              <Route path="/admin/logo-control" component={AdminLogoControl} />
              <Route path="/admin/amenities" component={AdminAmenities} />
              <Route path="/admin/map-design" component={AdminMapDesign} />
              <Route path="/admin/registrations" component={AdminRegistrations} />
              <Route path="/admin/contact-messages" component={AdminContactMessages} />
              <Route path="/admin/data-export" component={AdminDataExport} />
              <Route path="/admin/profile" component={Profile} />
              <Route path="/profile" component={Profile} />
              <Route path="/settings" component={Settings} />
              <Route path="/help" component={Help} />
              <Route path="/sales" component={SalesDashboard} />
              <Route path="/sales/leads" component={SalesDashboard} />
              <Route path="/sales/requests" component={RequestsBoard} />
              <Route path="/sales/registrations" component={AdminRegistrations} />
              <Route path="/sales/calendar" component={AdminCalendar} />
              <Route path="/sales/bookings/completed" component={CompletedBookings} />
              <Route path="/booking/generate" component={BookingGeneration} />
              <Route path="/properties" component={PropertySelection} />
              <Route path="/properties/:id" component={PropertyBooking} />
              <Route component={NotFound} />
            </Switch>
          </AdminLayout>
        ) : (
          <Layout>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/apply" component={Apply} />
              <Route path="/about" component={About} />
              <Route path="/contact" component={Contact} />
              <Route path="/faq" component={FAQ} />
              <Route path="/terms" component={Terms} />
              <Route path="/privacy" component={Privacy} />
              <Route path="/hostel-near-nmims" component={CollegeLandingPage} />
              <Route path="/hostel-near-mithibai" component={CollegeLandingPage} />
              <Route path="/hostel-near-mukesh-patel" component={CollegeLandingPage} />
              <Route path="/hostel-near-nm-college" component={CollegeLandingPage} />
              <Route path="/hostel-near-dj-sanghvi" component={CollegeLandingPage} />
              <Route path="/hostel-near-whistling-woods" component={CollegeLandingPage} />
              <Route path="/hostel-in-vile-parle" component={CollegeLandingPage} />
              <Route path="/hostel-in-goregaon" component={CollegeLandingPage} />
              <Route path="/dashboard" component={UserDashboard} />
              <Route path="/student/register" component={StudentRegistration} />
              <Route path="/properties" component={PropertySelection} />
              <Route path="/properties/:id" component={PropertyBooking} />
              <Route path="/payment-plans" component={PaymentPlans} />
              <Route path="/payment-gateway" component={PaymentGateway} />
              <Route path="/agreement" component={Agreement} />
              <Route path="/booking/generate" component={BookingGeneration} />
              <Route path="/my-bookings" component={MyBookings} />
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
