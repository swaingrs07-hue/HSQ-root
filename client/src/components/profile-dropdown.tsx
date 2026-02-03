import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  User,
  Settings,
  Key,
  Building2,
  HelpCircle,
  LogOut,
  ChevronDown,
} from "lucide-react";

const roleColors: Record<string, string> = {
  admin: "bg-red-100 text-red-700 border-red-200",
  sales_executive: "bg-blue-100 text-blue-700 border-blue-200",
  user: "bg-slate-100 text-slate-700 border-slate-200",
  student: "bg-green-100 text-green-700 border-green-200",
};

const roleLabels: Record<string, string> = {
  admin: "Admin",
  sales_executive: "Sales",
  user: "User",
  student: "Student",
};

export function ProfileDropdown() {
  const { user, logout, isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  const isSalesExec = user?.role === "sales_executive";
  const showProperties = isAdmin || isSalesExec;

  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  const menuItems = [
    { icon: User, label: "Profile", href: "/profile" },
    { icon: Settings, label: "Settings", href: "/settings" },
    { icon: Key, label: "Change Password", href: "/profile#password" },
    ...(showProperties
      ? [{ icon: Building2, label: "My Properties", href: "/properties" }]
      : []),
    { icon: HelpCircle, label: "Help & Support", href: "/help" },
  ];

  const DesktopDropdown = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 px-2 py-1.5 h-auto hover:bg-slate-100 rounded-full transition-all duration-200"
          data-testid="button-profile-dropdown"
        >
          <Avatar className="h-8 w-8 border-2 border-white shadow-sm">
            <AvatarImage src={user?.avatarUrl || undefined} alt={user?.name} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-white text-xs font-semibold">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden lg:flex flex-col items-start">
            <span className="text-sm font-medium text-foreground leading-tight">
              {user?.name}
            </span>
            <span className="text-xs text-muted-foreground leading-tight capitalize">
              {roleLabels[user?.role || "user"]}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground hidden lg:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-72 p-0 overflow-hidden"
        sideOffset={8}
      >
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="p-4 bg-gradient-to-br from-slate-50 to-white border-b">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 border-2 border-white shadow-md">
                <AvatarImage src={user?.avatarUrl || undefined} alt={user?.name} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-white font-semibold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">
                  {user?.name}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {user?.email}
                </p>
                <Badge
                  variant="outline"
                  className={`mt-1 text-xs ${roleColors[user?.role || "user"]}`}
                >
                  {roleLabels[user?.role || "user"]}
                </Badge>
              </div>
            </div>
          </div>

          <div className="py-2">
            {menuItems.map((item) => (
              <DropdownMenuItem
                key={item.href}
                asChild
                className="cursor-pointer px-4 py-2.5 focus:bg-slate-50"
              >
                <Link
                  href={item.href}
                  className="flex items-center gap-3"
                  data-testid={`link-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  <span>{item.label}</span>
                </Link>
              </DropdownMenuItem>
            ))}
          </div>

          <DropdownMenuSeparator className="my-0" />

          <div className="p-2">
            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer px-4 py-2.5 text-red-600 focus:text-red-600 focus:bg-red-50"
              data-testid="button-logout-dropdown"
            >
              <LogOut className="h-4 w-4 mr-3" />
              <span>Logout</span>
            </DropdownMenuItem>
          </div>
        </motion.div>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const MobileSheet = () => (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setMobileSheetOpen(true)}
        data-testid="button-profile-mobile"
      >
        <Avatar className="h-8 w-8 border-2 border-white shadow-sm">
          <AvatarImage src={user?.avatarUrl || undefined} alt={user?.name} />
          <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-white text-xs font-semibold">
            {userInitials}
          </AvatarFallback>
        </Avatar>
      </Button>

      <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-0 pb-8">
          <SheetHeader className="px-6 pb-4 border-b">
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14 border-2 border-white shadow-md">
                <AvatarImage src={user?.avatarUrl || undefined} alt={user?.name} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-white text-lg font-semibold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <SheetTitle className="text-lg">{user?.name}</SheetTitle>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <Badge
                  variant="outline"
                  className={`mt-1 text-xs ${roleColors[user?.role || "user"]}`}
                >
                  {roleLabels[user?.role || "user"]}
                </Badge>
              </div>
            </div>
          </SheetHeader>

          <div className="py-2">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileSheetOpen(false)}
                className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors"
                data-testid={`link-mobile-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                  <item.icon className="h-5 w-5 text-slate-600" />
                </div>
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </div>

          <div className="px-6 pt-4 border-t mt-2">
            <Button
              variant="outline"
              className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              onClick={() => {
                setMobileSheetOpen(false);
                handleLogout();
              }}
              data-testid="button-logout-mobile-sheet"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );

  return (
    <>
      <div className="hidden md:block">
        <DesktopDropdown />
      </div>
      <MobileSheet />
    </>
  );
}
