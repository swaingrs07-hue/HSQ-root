import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Menu, X, Sparkles, LayoutDashboard, LogOut, Home, Sun, Moon } from "lucide-react";
import hsquareLogo from "@/assets/hsquare-logo-full.png";
import { useAuth } from "@/contexts/auth-context";
import { ProfileDropdown } from "./profile-dropdown";

const HOTEL_NAV = [
  { name: "Home", href: "/hotels" },
  { name: "Rooms", href: "/hotels/rooms" },
  { name: "Experience", href: "/hotels#experience" },
  { name: "Contact", href: "/hotels#contact" },
];

type HotelsTheme = "dark" | "light";

export function HotelsLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<HotelsTheme>(() => {
    if (typeof window === "undefined") return "dark";
    const stored = window.localStorage.getItem("hotels-theme");
    return stored === "light" ? "light" : "dark";
  });
  const { user, logout } = useAuth();

  const isStaffRole = user && ["hotel_admin", "hotel_staff", "admin", "superadmin"].includes(user.role);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  useEffect(() => {
    try { window.localStorage.setItem("hotels-theme", theme); } catch {}
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <div
      className={cn(
        "min-h-screen flex flex-col text-white",
        theme === "light" && "hotels-light"
      )}
      style={{
        background: "var(--hotels-page-bg, #0a0a0a)",
        fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
      }}
      data-hotels-theme={theme}
      data-testid="hotels-layout-root"
    >
      <style>{`
        .hotels-heading { font-family: "Inter", system-ui, sans-serif; font-weight: 800; letter-spacing: -0.02em; }
        .hotels-display { font-family: "Inter", system-ui, sans-serif; font-weight: 900; letter-spacing: -0.03em; line-height: 0.95; }
        .gold-text { color: #c5a059; }
        .gold-bg { background-color: #c5a059; }
        .gold-border { border-color: #c5a059; }
        .glass-nav-h {
          background: rgba(10, 10, 10, 0.55);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border-bottom: 1px solid rgba(197, 160, 89, 0.12);
        }
        @keyframes hotelsFadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .hotels-fade-in { animation: hotelsFadeIn 0.8s ease-out forwards; }
      `}</style>

      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
          scrolled ? "glass-nav-h" : "bg-transparent"
        )}
        data-testid="hotels-header"
      >
        <div className={cn(
          "container mx-auto px-4 sm:px-6 flex items-center justify-between transition-all duration-500",
          scrolled ? "h-16" : "h-20"
        )}>
          <div className="flex items-center gap-3">
          <Link href="/hotels" className="flex items-center gap-3 group" data-testid="link-hotels-logo">
            <img
              src={hsquareLogo}
              alt="Hsquare Hotels"
              className={cn("hotels-logo w-auto object-contain transition-all duration-500", scrolled ? "h-9" : "h-11")}
              style={{ border: "none" }}
            />
            <span className="hidden sm:inline-block text-xs uppercase tracking-[0.3em] text-white/40 border-l border-white/15 pl-3 ml-1">
              Hotels
            </span>
          </Link>

            {/* Switch back to Hostel — mirrors the main-app Hotels pill */}
            <Link
              href="/"
              className={cn(
                "hidden lg:flex items-center gap-2 px-3.5 py-1.5 rounded-full transition-all duration-300 hover:scale-105 group flex-shrink-0",
                "border backdrop-blur-xl"
              )}
              style={{
                background: "rgba(255, 255, 255, 0.06)",
                borderColor: "rgba(255, 255, 255, 0.18)",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255,255,255,0.08)",
              }}
              data-testid="link-hostel-switcher"
            >
              <Home className="w-3.5 h-3.5 text-white/80" />
              <span className="text-[11px] font-semibold tracking-[0.16em] uppercase whitespace-nowrap text-white/85">
                Switch to Hostel
              </span>
              <span className="text-[10px] text-white/60 group-hover:-translate-x-0.5 transition-transform">
                ←
              </span>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            {HOTEL_NAV.map((item) => {
              const active = location === item.href || (item.href !== "/hotels" && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "text-[13px] uppercase tracking-[0.18em] transition-colors duration-300 relative group",
                    active ? "text-white" : "text-white/60 hover:text-white"
                  )}
                  data-testid={`link-hotel-nav-${item.name.toLowerCase()}`}
                >
                  {item.name}
                  <span
                    className={cn(
                      "absolute -bottom-2 left-0 h-px transition-all duration-300",
                      active ? "w-full" : "w-0 group-hover:w-full"
                    )}
                    style={{ backgroundColor: "#c5a059" }}
                  />
                </Link>
              );
            })}
            {isStaffRole && (
              <Link
                href="/hotels/dashboard"
                className="text-[13px] uppercase tracking-[0.18em] text-white/80 hover:text-white flex items-center gap-2"
                data-testid="link-hotel-dashboard"
              >
                <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
              </Link>
            )}
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full border transition-all duration-300 hover:scale-110"
              style={{
                borderColor: "rgba(197, 160, 89, 0.35)",
                background: "rgba(197, 160, 89, 0.08)",
              }}
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              data-testid="button-hotels-theme-toggle"
            >
              {theme === "dark"
                ? <Sun className="w-4 h-4" style={{ color: "#c5a059" }} />
                : <Moon className="w-4 h-4" style={{ color: "#c5a059" }} />}
            </button>
            {user ? (
              <ProfileDropdown />
            ) : (
              <Link
                href="/auth"
                className="text-[13px] uppercase tracking-[0.18em] text-white/70 hover:text-white"
                data-testid="link-hotels-signin"
              >
                Sign In
              </Link>
            )}
            <Link
              href="/hotels/rooms"
              className="px-6 py-2.5 text-[12px] uppercase tracking-[0.22em] font-semibold text-black transition-all duration-300 hover:scale-[1.03] active:scale-95"
              style={{ backgroundColor: "#c5a059", boxShadow: "0 8px 24px rgba(197,160,89,0.3)" }}
              data-testid="button-hotels-reserve"
            >
              Reserve
            </Link>
          </div>

          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full border"
              style={{
                borderColor: "rgba(197, 160, 89, 0.35)",
                background: "rgba(197, 160, 89, 0.08)",
              }}
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              data-testid="button-hotels-theme-toggle-mobile"
            >
              {theme === "dark"
                ? <Sun className="w-4 h-4" style={{ color: "#c5a059" }} />
                : <Moon className="w-4 h-4" style={{ color: "#c5a059" }} />}
            </button>
            <button
              className="p-2 text-white"
              onClick={() => setMobileOpen(!mobileOpen)}
              data-testid="button-hotels-mobile-menu"
              aria-label="Menu"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/95 backdrop-blur-2xl flex flex-col pt-20 px-4 sm:px-6 overflow-y-auto pb-8" data-testid="hotels-mobile-menu">
          <nav className="flex flex-col gap-1">
            {HOTEL_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="py-3 px-4 text-xl sm:text-2xl text-white/80 hover:text-white hover:bg-white/5 rounded-lg uppercase tracking-wider"
                data-testid={`link-hotels-mobile-${item.name.toLowerCase()}`}
              >
                {item.name}
              </Link>
            ))}
            {isStaffRole && (
              <Link
                href="/hotels/dashboard"
                onClick={() => setMobileOpen(false)}
                className="py-3 px-4 text-xl sm:text-2xl text-white/80 hover:text-white rounded-lg uppercase tracking-wider flex items-center gap-3"
              >
                <LayoutDashboard className="w-5 h-5" /> Dashboard
              </Link>
            )}
          </nav>
          <div className="mt-6 pt-6 border-t border-white/10 space-y-3">
            <Link
              href="/hotels/rooms"
              onClick={() => setMobileOpen(false)}
              className="block w-full py-4 text-center text-black font-semibold uppercase tracking-[0.2em] text-sm"
              style={{ backgroundColor: "#c5a059" }}
              data-testid="button-hotels-mobile-reserve"
            >
              Reserve
            </Link>
            {user ? (
              <button
                onClick={() => { setMobileOpen(false); logout(); }}
                className="w-full py-3 text-white/70 uppercase text-xs tracking-widest flex items-center justify-center gap-2"
                data-testid="button-hotels-mobile-logout"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            ) : (
              <button
                onClick={() => { setMobileOpen(false); navigate("/auth"); }}
                className="w-full py-3 text-white/70 uppercase text-xs tracking-widest"
                data-testid="button-hotels-mobile-signin"
              >
                Sign In
              </button>
            )}
            <Link
              href="/"
              onClick={() => setMobileOpen(false)}
              className="block w-full py-3 text-center text-white/50 uppercase text-xs tracking-widest hover:text-white"
              data-testid="link-hotels-mobile-back-hostels"
            >
              ← Back to Hostels
            </Link>
          </div>
        </div>
      )}

      <main className="flex-1">{children}</main>

      <footer className="border-t border-white/5 mt-16" style={{ backgroundColor: "var(--hotels-section-bg, #080808)" }}>
        <div className="container mx-auto px-4 sm:px-6 py-12 md:py-16">
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-10 md:gap-12 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <img src={hsquareLogo} alt="Hsquare Hotels" className="hotels-logo h-10 w-auto" />
                <span className="text-xs uppercase tracking-[0.3em] text-white/40 border-l border-white/15 pl-3">Hotels</span>
              </div>
              <p className="text-white/50 max-w-md leading-relaxed">
                Beyond exceptional. A new chapter of refined hospitality in the heart of Mumbai — designed for those who value craft, calm, and detail.
              </p>
            </div>
            <div>
              <h4 className="text-[11px] uppercase tracking-[0.25em] mb-5 gold-text">Discover</h4>
              <ul className="space-y-3 text-sm text-white/60">
                <li><Link href="/hotels/rooms" className="hover:text-white transition-colors">Rooms & Suites</Link></li>
                <li><Link href="/hotels#experience" className="hover:text-white transition-colors">Experience</Link></li>
                <li><Link href="/hotels#dining" className="hover:text-white transition-colors">Dining</Link></li>
                <li><Link href="/hotels#contact" className="hover:text-white transition-colors">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[11px] uppercase tracking-[0.25em] mb-5 gold-text">Connect</h4>
              <ul className="space-y-3 text-sm text-white/60">
                <li>support@hsquareliving.com</li>
                <li>+91 98765 43210</li>
                <li>Mumbai, India</li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-white/30 uppercase tracking-widest">
            <span>© {new Date().getFullYear()} Hsquareliving Pvt Ltd. All rights reserved.</span>
            <div className="flex flex-wrap gap-4 sm:gap-6">
              <Link href="/privacy" className="hover:text-white/60">Privacy</Link>
              <Link href="/terms" className="hover:text-white/60">Terms</Link>
              <Link href="/" className="hover:text-white/60">Hsquare Hostels</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
