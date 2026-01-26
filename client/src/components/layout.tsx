import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Home, User, Building2, ShieldCheck, Menu, X, LogOut, LayoutDashboard, Users, Target } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout, isAdmin } = useAuth();

  const isSalesExec = user?.role === "sales_executive";

  const navItems = isAdmin 
    ? [
        { name: "Home", href: "/", icon: Home },
        { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
        { name: "Properties", href: "/properties", icon: Building2 },
        { name: "Sales Team", href: "/admin/sales-management", icon: Users },
        { name: "Admin", href: "/admin", icon: ShieldCheck },
      ]
    : isSalesExec
    ? [
        { name: "Home", href: "/", icon: Home },
        { name: "Dashboard", href: "/sales", icon: Target },
        { name: "Properties", href: "/properties", icon: Building2 },
      ]
    : [
        { name: "Home", href: "/", icon: Home },
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "Properties", href: "/properties", icon: Building2 },
        { name: "Student Portal", href: "/student/register", icon: User },
      ];

  const userName = user?.name || "Guest";

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-heading font-bold text-xl group-hover:bg-accent transition-colors">
              H²
            </div>
            <span className="font-heading font-bold text-xl tracking-tight text-foreground">
              Hsquare<span className="text-primary">living</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary flex items-center gap-2",
                  location === item.href
                    ? "text-primary font-bold"
                    : "text-muted-foreground"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            ))}
            <div className="flex items-center gap-3 pl-4 border-l">
              <span className="text-sm text-muted-foreground">
                Hi, <span className="font-semibold text-foreground">{userName}</span>
                {user?.role && (
                  <span className="ml-1 text-xs text-primary capitalize">({user.role})</span>
                )}
              </span>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={logout}
                className="text-muted-foreground hover:text-destructive"
                data-testid="button-logout"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </nav>

          <button
            className="md:hidden p-2 text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="button-mobile-menu"
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-background p-4 flex flex-col gap-4 shadow-lg animate-in slide-in-from-top-5">
            <div className="flex items-center justify-between pb-4 border-b">
              <span className="text-sm text-muted-foreground">
                Hi, <span className="font-semibold text-foreground">{userName}</span>
                {user?.role && (
                  <span className="ml-1 text-xs text-primary capitalize">({user.role})</span>
                )}
              </span>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => { logout(); setMobileMenuOpen(false); }}
                className="text-muted-foreground hover:text-destructive"
                data-testid="button-logout-mobile"
              >
                <LogOut className="w-4 h-4 mr-2" /> Logout
              </Button>
            </div>
            {navItems.map((item) => (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "text-base font-medium transition-colors hover:text-primary flex items-center gap-3 p-2 rounded-md hover:bg-muted",
                  location === item.href
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground"
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            ))}
          </div>
        )}
      </header>

      <main className="flex-1 w-full">
        {children}
      </main>

      <footer className="border-t bg-card py-12 mt-12">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-heading font-bold text-xl">
                H²
              </div>
              <span className="font-heading font-bold text-xl tracking-tight">
                Hsquare<span className="text-primary">living</span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Premium student accommodation designed for comfort, community, and success.
            </p>
          </div>
          
          <div>
            <h4 className="font-heading font-bold text-foreground mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/properties">Properties</Link></li>
              <li><Link href="/about">About Us</Link></li>
              <li><Link href="/contact">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading font-bold text-foreground mb-4">Support</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/faq">FAQs</Link></li>
              <li><Link href="/terms">Terms & Conditions</Link></li>
              <li><Link href="/privacy">Privacy Policy</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading font-bold text-foreground mb-4">Contact</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>support@hsquareliving.com</li>
              <li>+91 98765 43210</li>
              <li>Bangalore, India</li>
            </ul>
          </div>
        </div>
        <div className="container mx-auto px-4 mt-12 pt-8 border-t text-center text-xs text-muted-foreground">
          © 2026 Hsquareliving Pvt Ltd. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
