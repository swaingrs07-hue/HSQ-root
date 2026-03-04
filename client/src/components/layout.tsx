import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Home, User, Building2, ShieldCheck, Menu, X, LogOut, LayoutDashboard, Users, Target, Search, Mail, Phone, MapPin, ArrowUpRight } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import hsquareLogo from "@/assets/hsquare-logo-full.png";
import { ProfileDropdown } from "./profile-dropdown";
import { SmartSearch } from "./smart-search";

interface FooterLink { label: string; href: string; }
interface FooterData {
  companyDescription: string;
  email: string;
  phone: string;
  location: string;
  copyrightText: string;
  quickLinks: FooterLink[];
  supportLinks: FooterLink[];
  socialInstagram?: string;
  socialFacebook?: string;
  socialTwitter?: string;
  socialLinkedin?: string;
}

const DEFAULT_FOOTER: FooterData = {
  companyDescription: "Premium student accommodation designed for comfort, community, and success.",
  email: "support@hsquareliving.com",
  phone: "+91 98765 43210",
  location: "Bangalore, India",
  copyrightText: "Hsquareliving Pvt Ltd. All rights reserved.",
  quickLinks: [{ label: "Properties", href: "/properties" }, { label: "About Us", href: "/about" }, { label: "Contact", href: "/contact" }],
  supportLinks: [{ label: "FAQs", href: "/faq" }, { label: "Terms & Conditions", href: "/terms" }, { label: "Privacy Policy", href: "/privacy" }],
};

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [, setNav] = useLocation();
  const { user, logout, isAdmin } = useAuth();

  const isHomePage = location === "/";

  useEffect(() => {
    if (!isHomePage) { setScrolled(true); return; }
    const handleScroll = () => setScrolled(window.scrollY > 50);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isHomePage]);

  useEffect(() => {
    if (!searchOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [searchOpen]);

  const handleSearchResults = (results: any) => {
    if (results.totalResults > 0 || results.interpretation) {
      sessionStorage.setItem("searchResults", JSON.stringify(results));
      setSearchOpen(false);
      setNav("/properties");
    }
  };

  const { data: footer = DEFAULT_FOOTER } = useQuery<FooterData>({
    queryKey: ["/api/footer-settings"],
    queryFn: async () => {
      const res = await fetch("/api/footer-settings");
      if (!res.ok) return DEFAULT_FOOTER;
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  const { data: logoSettings } = useQuery<{ headerLogo?: string | null; footerLogo?: string | null }>({
    queryKey: ["/api/logo-settings"],
    queryFn: async () => {
      const res = await fetch("/api/logo-settings");
      if (!res.ok) return {};
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  const activeLogo = logoSettings?.headerLogo || hsquareLogo;
  const activeFooterLogo = logoSettings?.footerLogo || logoSettings?.headerLogo || hsquareLogo;

  const isSalesExec = user?.role === "sales_executive";

  const navItems = isAdmin 
    ? [
        { name: "Home", href: "/", icon: Home },
        { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
        { name: "Properties", href: "/properties", icon: Building2 },
        { name: "Sales Team", href: "/admin/sales-management", icon: Users },
      ]
    : isSalesExec
    ? [
        { name: "Home", href: "/", icon: Home },
        { name: "Dashboard", href: "/sales", icon: Target },
        { name: "Properties", href: "/properties", icon: Building2 },
      ]
    : user
    ? [
        { name: "Home", href: "/", icon: Home },
        { name: "My Bookings", href: "/my-bookings", icon: LayoutDashboard },
        { name: "Properties", href: "/properties", icon: Building2 },
      ]
    : [
        { name: "Home", href: "/", icon: Home },
        { name: "Properties", href: "/properties", icon: Building2 },
      ];

  const userName = user?.name || "Guest";

  const headerTransparent = isHomePage && !scrolled && !mobileMenuOpen;

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <header className={cn(
        "fixed top-0 z-50 w-full transition-all duration-300",
        headerTransparent
          ? "bg-transparent border-b border-transparent"
          : "bg-background/95 backdrop-blur-md border-b border-border shadow-sm"
      )}>
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <img src={activeLogo} alt="Hsquare Living" className="h-12 w-auto object-contain" />
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "text-sm font-medium transition-colors flex items-center gap-2",
                  headerTransparent
                    ? "text-white/90 hover:text-white"
                    : location === item.href
                      ? "text-primary font-bold"
                      : "text-muted-foreground hover:text-primary"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            ))}
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className={cn(
                "p-2 rounded-full transition-all duration-200",
                searchOpen
                  ? "bg-amber-600 text-white"
                  : headerTransparent
                    ? "text-white/80 hover:text-white hover:bg-white/10"
                    : "text-muted-foreground hover:text-primary hover:bg-muted"
              )}
              data-testid="button-search-toggle"
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
            </button>
            <div className={cn("pl-4 border-l", headerTransparent ? "border-white/20" : "")}>
              <ProfileDropdown />
            </div>
          </nav>

          <div className="md:hidden flex items-center gap-1">
            <button
              className={cn("p-2 rounded-full transition-colors", headerTransparent ? "text-white hover:bg-white/10" : "text-foreground hover:bg-muted")}
              onClick={() => { setSearchOpen(!searchOpen); setMobileMenuOpen(false); }}
              data-testid="button-search-toggle-mobile"
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>
            <button
              className={cn("p-2", headerTransparent ? "text-white" : "text-foreground")}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-background p-4 flex flex-col gap-4 shadow-lg animate-in slide-in-from-top-5">
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
            <div className="border-t pt-3">
              <SmartSearch
                onSearchResults={handleSearchResults}
                placeholder="Search properties, locations..."
                className="[&_input]:h-10"
              />
            </div>
          </div>
        )}

        {searchOpen && (
          <div
            ref={searchRef}
            className="absolute top-full left-0 right-0 z-50 animate-in slide-in-from-top-2 duration-300"
            data-testid="search-panel"
          >
            <div className="mx-4 mt-3 mb-2">
              <div className="max-w-2xl mx-auto bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-5 ring-1 ring-white/10">
                <SmartSearch
                  onSearchResults={handleSearchResults}
                  placeholder="Search properties, locations, or ask AI..."
                  className="[&_input]:h-12 [&_input]:text-base [&_input]:rounded-xl [&_input]:bg-white/15 [&_input]:backdrop-blur-sm [&_input]:border-white/25 [&_input]:text-white [&_input]:placeholder:text-white/60 [&_input]:focus:border-amber-400/60 [&_input]:focus:ring-amber-400/20 [&_input]:focus:bg-white/20 [&_button]:bg-amber-500 [&_button]:hover:bg-amber-400 [&_button]:text-white [&_button]:rounded-xl [&_button]:border-0"
                />
                <p className="text-xs text-white/50 mt-2.5 text-center tracking-wide">Press Escape to close</p>
              </div>
            </div>
          </div>
        )}
      </header>

      {!isHomePage && <div className="h-16" />}

      <main className="flex-1 w-full">
        {children}
      </main>

      <footer className="bg-stone-900 text-stone-300 mt-16" data-testid="site-footer">
        <div className="container mx-auto px-6 pt-16 pb-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8">
            <div className="md:col-span-4 space-y-5">
              <div className="flex items-center gap-3">
                <img src={activeFooterLogo} alt="Hsquare Living" className="h-12 w-auto object-contain brightness-0 invert" />
              </div>
              <p className="text-sm text-stone-400 leading-relaxed max-w-xs">
                {footer.companyDescription}
              </p>
              <div className="flex gap-3 pt-1">
                {footer.socialInstagram && (
                  <a href={footer.socialInstagram} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-stone-800 hover:bg-amber-600 flex items-center justify-center transition-all duration-200 group" data-testid="link-social-instagram">
                    <svg className="w-4 h-4 text-stone-400 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                  </a>
                )}
                {footer.socialFacebook && (
                  <a href={footer.socialFacebook} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-stone-800 hover:bg-amber-600 flex items-center justify-center transition-all duration-200 group" data-testid="link-social-facebook">
                    <svg className="w-4 h-4 text-stone-400 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  </a>
                )}
                {footer.socialTwitter && (
                  <a href={footer.socialTwitter} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-stone-800 hover:bg-amber-600 flex items-center justify-center transition-all duration-200 group" data-testid="link-social-twitter">
                    <svg className="w-4 h-4 text-stone-400 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  </a>
                )}
                {footer.socialLinkedin && (
                  <a href={footer.socialLinkedin} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-stone-800 hover:bg-amber-600 flex items-center justify-center transition-all duration-200 group" data-testid="link-social-linkedin">
                    <svg className="w-4 h-4 text-stone-400 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                  </a>
                )}
                {!footer.socialInstagram && !footer.socialFacebook && !footer.socialTwitter && !footer.socialLinkedin && (
                  <>
                    <a href="https://instagram.com/hsquareliving" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-stone-800 hover:bg-amber-600 flex items-center justify-center transition-all duration-200 group" data-testid="link-social-instagram">
                      <svg className="w-4 h-4 text-stone-400 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                    </a>
                    <a href="https://linkedin.com/company/hsquareliving" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-stone-800 hover:bg-amber-600 flex items-center justify-center transition-all duration-200 group" data-testid="link-social-linkedin">
                      <svg className="w-4 h-4 text-stone-400 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                    </a>
                  </>
                )}
              </div>
            </div>

            {footer.quickLinks.length > 0 && (
              <div className="md:col-span-2">
                <h4 className="font-heading font-bold text-white text-sm uppercase tracking-widest mb-5">Quick Links</h4>
                <ul className="space-y-3">
                  {footer.quickLinks.map((link, i) => (
                    <li key={i}>
                      <Link href={link.href} className="text-sm text-stone-400 hover:text-amber-400 transition-colors duration-200 flex items-center gap-1.5 group">
                        <ArrowUpRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                        <span>{link.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {footer.supportLinks.length > 0 && (
              <div className="md:col-span-2">
                <h4 className="font-heading font-bold text-white text-sm uppercase tracking-widest mb-5">Support</h4>
                <ul className="space-y-3">
                  {footer.supportLinks.map((link, i) => (
                    <li key={i}>
                      <Link href={link.href} className="text-sm text-stone-400 hover:text-amber-400 transition-colors duration-200 flex items-center gap-1.5 group">
                        <ArrowUpRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                        <span>{link.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="md:col-span-4">
              <h4 className="font-heading font-bold text-white text-sm uppercase tracking-widest mb-5">Contact</h4>
              <ul className="space-y-4">
                <li>
                  <a href={`mailto:${footer.email}`} className="flex items-center gap-3 text-sm text-stone-400 hover:text-amber-400 transition-colors duration-200 group">
                    <div className="w-8 h-8 rounded-lg bg-stone-800 group-hover:bg-amber-600/20 flex items-center justify-center transition-colors shrink-0">
                      <Mail className="w-4 h-4 text-stone-500 group-hover:text-amber-400 transition-colors" />
                    </div>
                    {footer.email}
                  </a>
                </li>
                <li>
                  <a href={`tel:${footer.phone}`} className="flex items-center gap-3 text-sm text-stone-400 hover:text-amber-400 transition-colors duration-200 group">
                    <div className="w-8 h-8 rounded-lg bg-stone-800 group-hover:bg-amber-600/20 flex items-center justify-center transition-colors shrink-0">
                      <Phone className="w-4 h-4 text-stone-500 group-hover:text-amber-400 transition-colors" />
                    </div>
                    {footer.phone}
                  </a>
                </li>
                <li className="flex items-center gap-3 text-sm text-stone-400">
                  <div className="w-8 h-8 rounded-lg bg-stone-800 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4 text-stone-500" />
                  </div>
                  {footer.location}
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="border-t border-stone-800">
          <div className="container mx-auto px-6 py-5 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-xs text-stone-500">
              &copy; {new Date().getFullYear()} {footer.copyrightText}
            </p>
            <p className="text-xs text-stone-600">
              Where Comfort Meets Class.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
