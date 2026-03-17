import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  Target, 
  BookOpen, 
  FileText, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  LogOut,
  Bell,
  User,
  ChevronDown,
  TrendingUp,
  CalendarCheck,
  Menu,
  Camera,
  Kanban,
  CheckCheck,
  Info,
  AlertTriangle,
  CheckCircle,
  XCircle,
  UserPlus,
  CreditCard,
  Calendar,
  Clock,
  Activity,
  Bot,
  UserCog,
  Image as ImageIcon,
  PanelBottom,
  CheckCircle2,
  Globe,
  Layers,
  Package,
  Link2,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import hsquareLogo from "@/assets/hsquare-logo-full.png";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { PropertySwitcher } from "@/components/property-switcher";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error" | "lead" | "booking" | "payment" | "follow_up";
  isRead: boolean;
  actionUrl?: string;
  createdAt: string;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const adminNavItems: NavItem[] = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Requests", href: "/admin/requests", icon: Kanban },
  { name: "Team", href: "/admin/users", icon: Users },
  { name: "Sales Management", href: "/admin/sales-management", icon: UserCog },
  { name: "Leads", href: "/admin/leads", icon: Target },
  { name: "Bookings", href: "/admin/booking/generate", icon: CalendarCheck },
  { name: "Completed Bookings", href: "/admin/bookings/completed", icon: CheckCircle2 },
  { name: "Calendar", href: "/admin/calendar", icon: Calendar },
  { name: "Reports", href: "/admin/lead-analytics", icon: TrendingUp },
  { name: "Activity Log", href: "/admin/activity-logs", icon: Activity },
  { name: "Tour Images", href: "/admin/property-tour-images", icon: Camera },
  { name: "3D Virtual Tour", href: "/admin/virtual-tour-uploads", icon: Globe },
  { name: "Floors & Beds", href: "/admin/floors-beds", icon: Building2 },
  { name: "Booking Tree", href: "/admin/booking-tree", icon: Layers },
  { name: "Housing Plans", href: "/admin/packages", icon: Package },
  { name: "Add-On Services", href: "/admin/addon-services", icon: UtensilsCrossed },
  { name: "Seasons", href: "/admin/seasons", icon: Calendar },
  { name: "HMS Sync", href: "/admin/hms-sync", icon: Link2 },
  { name: "Hero Slides", href: "/admin/hero-slides", icon: ImageIcon },
  { name: "Amenities", href: "/admin/amenities", icon: Sparkles },
  { name: "Footer", href: "/admin/footer-settings", icon: PanelBottom },
  { name: "AI Chatbot", href: "/admin/ai-chatbot", icon: Bot },
  { name: "Data Export", href: "/admin/data-export", icon: FileText },
  { name: "Settings", href: "/admin/settings", icon: Settings },
];

const receptionistNavItems: NavItem[] = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Requests", href: "/admin/requests", icon: Kanban },
  { name: "Completed Bookings", href: "/admin/bookings/completed", icon: CheckCircle2 },
  { name: "Calendar", href: "/admin/calendar", icon: Calendar },
  { name: "Floors & Beds", href: "/admin/floors-beds", icon: Building2 },
  { name: "Booking Tree", href: "/admin/booking-tree", icon: Layers },
];

const salesNavItems: NavItem[] = [
  { name: "Dashboard", href: "/sales", icon: LayoutDashboard },
  { name: "Requests", href: "/sales/requests", icon: Kanban },
  { name: "My Leads", href: "/sales", icon: Target },
  { name: "Properties", href: "/properties", icon: Building2 },
  { name: "Bookings", href: "/booking/generate", icon: CalendarCheck },
  { name: "My Bookings", href: "/sales/bookings/completed", icon: CheckCircle2 },
  { name: "Calendar", href: "/admin/calendar", icon: Calendar },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, logout, isAdmin, token } = useAuth();
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  
  const isSalesExec = user?.role === "sales_executive";
  const isReceptionist = user?.role === "receptionist";
  const isMainAdmin = user?.email === "gyan@hsquareliving.com";
  const navItems = isReceptionist
    ? receptionistNavItems
    : isAdmin
      ? [
          ...adminNavItems,
          ...(isMainAdmin ? [{ name: "Logo Control", href: "/admin/logo-control", icon: ImageIcon }] : []),
        ]
      : salesNavItems;
  
  const userName = user?.name || "User";
  const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const { data: logoData } = useQuery<{ adminLogo?: string | null; headerLogo?: string | null }>({
    queryKey: ["/api/logo-settings"],
    queryFn: async () => {
      const res = await fetch("/api/logo-settings");
      if (!res.ok) return {};
      return res.json();
    },
    staleTime: 60 * 1000,
  });
  const activeAdminLogo = logoData?.adminLogo || logoData?.headerLogo || hsquareLogo;

  // Fetch notifications
  const { data: notificationData } = useQuery<{ notifications: Notification[]; unreadCount: number }>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications?limit=10", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await fetch("/api/notifications/mark-all-read", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/notifications/${id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const notifications = notificationData?.notifications || [];
  const unreadCount = notificationData?.unreadCount || 0;

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "success": return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case "warning": return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case "error": return <XCircle className="w-4 h-4 text-rose-500" />;
      case "lead": return <UserPlus className="w-4 h-4 text-indigo-500" />;
      case "booking": return <Calendar className="w-4 h-4 text-purple-500" />;
      case "payment": return <CreditCard className="w-4 h-4 text-emerald-500" />;
      case "follow_up": return <Clock className="w-4 h-4 text-orange-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markReadMutation.mutate(notification.id);
    }
    if (notification.actionUrl) {
      setNotificationOpen(false);
      setLocation(notification.actionUrl);
    }
  };

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  return (
    <div className="h-screen bg-slate-50 dark:bg-slate-900 flex overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside 
        className={cn(
          "hidden lg:flex flex-col fixed left-0 top-0 h-full bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 z-40 transition-all duration-300 ease-in-out shadow-sm",
          collapsed ? "w-20" : "w-64"
        )}
      >
        {/* Logo */}
        <div className={cn(
          "h-16 flex items-center border-b border-slate-200 dark:border-slate-700 px-4",
          collapsed ? "justify-center" : "justify-between"
        )}>
          {!collapsed && (
            <Link href="/" className="flex items-center">
              <img src={activeAdminLogo} alt="Hsquare Living" className="h-10 w-auto object-contain" />
            </Link>
          )}
          {collapsed && (
            <Link href="/">
              <img src={activeAdminLogo} alt="Hsquare Living" className="h-8 w-auto object-contain" />
            </Link>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.href || 
              (item.href !== "/admin" && location.startsWith(item.href));
            
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group cursor-pointer",
                    isActive
                      ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/25"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50",
                    collapsed && "justify-center px-2"
                  )}
                  data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <item.icon className={cn(
                    "w-5 h-5 flex-shrink-0 transition-transform duration-200",
                    !isActive && "group-hover:scale-110"
                  )} />
                  {!collapsed && (
                    <>
                      <span className="flex-1">{item.name}</span>
                      {item.badge && (
                        <span className="bg-rose-500 text-white text-xs px-2 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Collapse Toggle */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
            data-testid="button-collapse-sidebar"
          >
            {collapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <>
                <ChevronLeft className="w-5 h-5" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside 
        className={cn(
          "lg:hidden fixed left-0 top-0 h-full w-72 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 z-50 transition-transform duration-300 ease-in-out shadow-xl",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-16 flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-4">
          <Link href="/" className="flex items-center">
            <img src={activeAdminLogo} alt="Hsquare Living" className="h-10 w-auto object-contain" />
          </Link>
          <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-slate-500 hover:text-slate-700">
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>
        <nav className="py-6 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className={cn(
        "flex-1 flex flex-col h-screen transition-all duration-300",
        collapsed ? "lg:ml-20" : "lg:ml-64"
      )}>
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-16 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 px-4 lg:px-6 flex items-center justify-between">
          {/* Left: Mobile Menu + Page Title */}
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              onClick={() => setMobileMenuOpen(true)}
              data-testid="button-mobile-menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:block">
              <h1 className="text-lg font-semibold text-slate-800 dark:text-white">
                {navItems.find(item => location === item.href || (item.href !== "/admin" && location.startsWith(item.href)))?.name || "Dashboard"}
              </h1>
            </div>
          </div>

          {/* Center: Property Switcher (hidden on pages where it's not needed) */}
          {!location.startsWith("/admin/add-property") && (
            <div className="flex-1 flex justify-center max-w-md mx-4">
              <PropertySwitcher />
            </div>
          )}

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            {/* Notifications */}
            <Popover open={notificationOpen} onOpenChange={setNotificationOpen}>
              <PopoverTrigger asChild>
                <button 
                  className="relative p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  data-testid="button-notifications"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-rose-500 text-white text-[10px] font-bold rounded-full px-1">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0 shadow-lg">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
                  <h3 className="font-semibold text-slate-800">Notifications</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllReadMutation.mutate()}
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                      data-testid="button-mark-all-read"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Mark all read
                    </button>
                  )}
                </div>
                <ScrollArea className="max-h-[320px]">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                      <Bell className="w-10 h-10 mb-2 opacity-30" />
                      <p className="text-sm">No notifications yet</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {notifications.map((notification) => (
                        <button
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={cn(
                            "w-full text-left p-3 hover:bg-slate-50 transition-colors flex gap-3",
                            !notification.isRead && "bg-indigo-50/50"
                          )}
                          data-testid={`notification-${notification.id}`}
                        >
                          <div className="flex-shrink-0 mt-0.5">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-sm line-clamp-1",
                              !notification.isRead ? "font-semibold text-slate-800" : "text-slate-600"
                            )}>
                              {notification.title}
                            </p>
                            <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                              {notification.message}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-1">
                              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                          {!notification.isRead && (
                            <div className="flex-shrink-0">
                              <span className="w-2 h-2 bg-indigo-500 rounded-full block" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                {notifications.length > 0 && (
                  <div className="p-2 border-t">
                    <Link href="/admin/notifications">
                      <button 
                        onClick={() => setNotificationOpen(false)}
                        className="w-full text-center py-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        View all notifications
                      </button>
                    </Link>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" data-testid="button-user-menu">
                  <Avatar className="h-8 w-8 bg-gradient-to-br from-indigo-500 to-purple-600">
                    <AvatarFallback className="bg-transparent text-white text-sm font-medium">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{userName}</p>
                    <p className="text-xs text-slate-500 capitalize">{user?.role || 'User'}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <Link href="/admin/profile">
                  <DropdownMenuItem className="cursor-pointer">
                    <User className="w-4 h-4 mr-2" />
                    Profile
                  </DropdownMenuItem>
                </Link>
                <Link href="/admin/settings">
                  <DropdownMenuItem className="cursor-pointer">
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="cursor-pointer text-rose-600 focus:text-rose-600"
                  onClick={logout}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto min-h-0">
          {children}
        </main>
      </div>
    </div>
  );
}

export function AdminPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}
