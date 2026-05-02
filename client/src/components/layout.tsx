import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Home, User, Building2, ShieldCheck, Menu, X, LogOut, LayoutDashboard, Users, Target, Search, Mail, Phone, MapPin, ArrowUpRight, MessageSquare, Smartphone, Star } from "lucide-react";
import { useState, useEffect, useRef, lazy, Suspense, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { useAuthGuard } from "@/contexts/auth-guard-context";
import hsquareLogo from "@/assets/hsquare-logo-full.png";
import { ProfileDropdown } from "./profile-dropdown";
import { SmartSearch } from "./smart-search";
import { AnimatedLogo } from "./animated-logo";
import { PullToRefresh } from "./pull-to-refresh";
import { TubesContext } from "@/contexts/tubes-context";

const TubesCursorBackground = lazy(
  () => import("@/components/tubes-cursor-background"),
);
// Lightweight CSS-only iridescent stand-in shown when the WebGL tubes
// can't run on the device (no WebGL context, or adaptive FPS gate fired
// because the GPU is too slow). See iridescent-fallback-background.tsx
// for the rationale and rule #8 in replit.md for the invariants.
const IridescentFallbackBackground = lazy(
  () => import("@/components/iridescent-fallback-background"),
);

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
  androidDownloadUrl?: string;
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
  const [scrollProgress, setScrollProgress] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [, setNav] = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const { openAuthModal } = useAuthGuard();

  const isHomePage = location === "/";
  const isPropertyPage = /^\/properties(\/[^/]+)?$/.test(location);
  const isMyBookingsPage = location === "/my-bookings";
  const isAboutPage = location === "/about";
  const isContactPage = location === "/contact";
  const isFaqPage = location === "/faq";
  const isTermsPage = location === "/terms";
  const isPrivacyPage = location === "/privacy";
  const isApplyPage = location === "/apply";
  const hasTransparentHeader = isHomePage || isPropertyPage || isMyBookingsPage || isAboutPage || isContactPage || isFaqPage || isTermsPage || isPrivacyPage || isApplyPage;

  // Single, persistent tube cursor background. Mounted once at the Layout
  // level so navigating between routes never tears down the WebGL context
  // or re-fetches the CDN script. Activated immediately on mount so the
  // iridescent tube background (and the hero-video blur effect that
  // depends on it) is visible from the first paint. We still respect
  // reduced-motion and save-data, and the tubes-cursor-background
  // component calls onFailure -> active=false if WebGL is unavailable
  // or the adaptive FPS gate decides the device can't sustain it.
  //
  // We track save-data separately so we can distinguish "user opted out
  // of richness" (save-data / reduced-motion → show NO background, just
  // plain dark) from "device couldn't sustain WebGL" (FPS gate fired or
  // WebGL missing → show the lightweight CSS iridescent fallback so the
  // user still gets the same premium aesthetic without the GPU cost).
  const [saveDataMode] = useState(() => {
    if (typeof window === "undefined") return false;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection || null;
    return !!conn?.saveData;
  });
  const [tubesSupported, setTubesSupported] = useState(() => {
    if (typeof window === "undefined") return false;
    return true;
  });
  const handleGlobalTubesFailure = useCallback(() => setTubesSupported(false), []);

  // Reactive prefers-reduced-motion + small-viewport detection. Both
  // signals can change after mount (a user toggling OS-level
  // reduced-motion, or rotating / resizing a window) and we want the
  // layout to re-evaluate the global tube layer in real time so we
  // never strand a slow device with a heavy WebGL canvas running
  // underneath the hero video.
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) =>
      setPrefersReducedMotion(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  // Effective tube state. Tubes are skipped only when the device or
  // user signals it can't afford them (reduced-motion, save-data, or
  // no WebGL / FPS gate fired). The mobile-homepage exclusion that
  // used to live here existed because the iridescent tubes composited
  // under the hero video and caused stuttering on small phones. That
  // root cause is now solved by the hero pausing the tubes while the
  // video is on screen (Task #127), so mobile users get the full
  // iridescent background everywhere — including the homepage.
  const globalTubesActive = tubesSupported && !prefersReducedMotion && !saveDataMode;

  // Should we render the lightweight CSS iridescent fallback in place
  // of the WebGL tubes? Only when the device couldn't afford the WebGL
  // version (no support, FPS gate fired) AND the user hasn't asked us
  // to be quiet (reduced-motion / save-data). The fallback is what
  // saves the user on a Dell G15-class machine from staring at a flat
  // #050505 page after the FPS gate disables the real tubes.
  const tubesFallbackActive =
    !globalTubesActive && !prefersReducedMotion && !saveDataMode;

  // Allow individual pages (currently the home hero video) to ask the
  // global iridescent tube background to pause its WebGL render loop
  // while a heavy <video> element is on screen. We keep the canvas
  // mounted so the GPU context isn't torn down — we just stop the
  // animation loop, which frees the GPU for video decoding and is the
  // single biggest fix for hero-video stutter on mid-range devices.
  const [tubesPauseRequested, setTubesPauseRequested] = useState(false);
  const handleSetTubesPauseRequested = useCallback((paused: boolean) => {
    setTubesPauseRequested(paused);
  }, []);

  // Scroll-tied opacity setter for the global tubes layer. Pages (currently
  // the homepage card-swipe in Task #147) call this on scroll to fade the
  // iridescent tubes in only after the hero has been covered. We deliberately
  // route this through a CSS custom property instead of React state so that
  // a 60Hz scroll handler doesn't re-render the entire Layout subtree on
  // every frame — the property mutation is a constant-time DOM write and
  // the tubes / veil layers consume it via `opacity: var(--tubes-reveal-opacity, 1)`.
  // Pages MUST reset the property to "1" on unmount so that subsequent
  // routes (which don't run the scroll handler) see the tubes at full
  // brightness immediately.
  const handleSetTubesRevealOpacity = useCallback((opacity: number) => {
    if (typeof document === "undefined") return;
    const clamped = Math.max(0, Math.min(1, opacity));
    document.documentElement.style.setProperty(
      "--tubes-reveal-opacity",
      String(clamped),
    );
  }, []);

  // Track whether the global iridescent tube background has actually
  // rendered its first WebGL frame. The homepage loading overlay reads
  // this through TubesContext so it can hold the splash on screen until
  // the 3D background is visually present (and thus avoid a hard pop-in
  // moment when the loader exits). When the tubes are intentionally
  // disabled (reduced-motion, save-data, no WebGL), there is nothing to
  // wait for, so we report "ready" immediately to never block the loader.
  const [tubesReady, setTubesReady] = useState(false);
  const handleTubesReady = useCallback(() => setTubesReady(true), []);
  useEffect(() => {
    if (!globalTubesActive) setTubesReady(true);
  }, [globalTubesActive]);
  const effectiveTubesReady = !globalTubesActive || tubesReady;

  useEffect(() => {
    if (!hasTransparentHeader) { setScrolled(true); return; }
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasTransparentHeader]);

  useEffect(() => {
    const handleScrollProgress = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0;
      setScrollProgress(progress);
    };
    window.addEventListener("scroll", handleScrollProgress, { passive: true });
    handleScrollProgress();
    return () => window.removeEventListener("scroll", handleScrollProgress);
  }, []);

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

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

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
  const isReceptionist = user?.role === "receptionist";

  const navItems = isAdmin 
    ? [
        { name: "Home", href: "/", icon: Home },
        { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
        { name: "Properties", href: "/properties", icon: Building2 },
        { name: "Sales Team", href: "/admin/sales-management", icon: Users },
        { name: "Contact", href: "/contact", icon: MessageSquare },
      ]
    : isReceptionist
    ? [
        { name: "Home", href: "/", icon: Home },
        { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
        { name: "Properties", href: "/properties", icon: Building2 },
        { name: "Contact", href: "/contact", icon: MessageSquare },
      ]
    : isSalesExec
    ? [
        { name: "Home", href: "/", icon: Home },
        { name: "Dashboard", href: "/sales", icon: Target },
        { name: "Properties", href: "/properties", icon: Building2 },
        { name: "Contact", href: "/contact", icon: MessageSquare },
      ]
    : user
    ? [
        { name: "Home", href: "/", icon: Home },
        { name: "My Bookings", href: "/my-bookings", icon: LayoutDashboard },
        { name: "Properties", href: "/properties", icon: Building2 },
        { name: "Contact", href: "/contact", icon: MessageSquare },
      ]
    : [
        { name: "Home", href: "/", icon: Home },
        { name: "Properties", href: "/properties", icon: Building2 },
        { name: "Contact", href: "/contact", icon: MessageSquare },
      ];

  const userName = user?.name || "Guest";

  const headerTransparent = hasTransparentHeader && !scrolled && !mobileMenuOpen;

  // Memoize the context value so it only changes when its primitive
  // members do. Without this, every Layout render (e.g. on scroll
  // state changes) would hand consumers a brand-new object literal,
  // causing any consumer that depends on `tubesCtx` (or even on the
  // whole context value) to re-run effects on every parent render.
  // The home page in particular drives a 60Hz scroll handler that
  // would otherwise tear down and rebind listeners constantly.
  const tubesContextValue = useMemo(
    () => ({
      active: globalTubesActive,
      ready: effectiveTubesReady,
      setPauseRequested: handleSetTubesPauseRequested,
      setRevealOpacity: handleSetTubesRevealOpacity,
    }),
    [
      globalTubesActive,
      effectiveTubesReady,
      handleSetTubesPauseRequested,
      handleSetTubesRevealOpacity,
    ],
  );

  return (
    <TubesContext.Provider value={tubesContextValue}>
    <div
      className="min-h-screen bg-[#050505] flex flex-col font-sans relative"
      data-testid="layout-root"
    >
      {globalTubesActive && (
        <>
          <div
            className="fixed inset-0 z-0 pointer-events-none"
            data-testid="tubes-global-layer"
            style={{
              transform: "translateZ(0)",
              willChange: "transform",
              contain: "strict",
              isolation: "isolate",
              // Scroll-tied opacity. Default 1 (full brightness) on every
              // page. The homepage card-swipe (Task #147) drives this to
              // 0 while the hero is in view and ramps it back to 1 once
              // the next section has covered the hero, so the tubes
              // visually "activate from" the Why Choose section.
              opacity: "var(--tubes-reveal-opacity, 1)",
            }}
          >
            <Suspense fallback={null}>
              <TubesCursorBackground
                enabled={globalTubesActive}
                paused={tubesPauseRequested}
                onFailure={handleGlobalTubesFailure}
                onReady={handleTubesReady}
              />
            </Suspense>
          </div>
          {/* A whisper-thin dark veil: tubes stay full-bright everywhere
              while text gains just enough contrast to read comfortably.
              Fades alongside the tubes so the hero doesn't get an extra
              dark wash during the card-swipe (Task #147). */}
          <div
            className="fixed inset-0 z-[1] pointer-events-none"
            aria-hidden="true"
            data-testid="tubes-global-veil"
            style={{
              background: "rgba(5,5,5,0.22)",
              opacity: "var(--tubes-reveal-opacity, 1)",
            }}
          />
        </>
      )}
      {tubesFallbackActive && (
        <>
          <div
            className="fixed inset-0 z-0 pointer-events-none"
            data-testid="tubes-fallback-layer"
            style={{
              opacity: "var(--tubes-reveal-opacity, 1)",
            }}
          >
            <Suspense fallback={null}>
              <IridescentFallbackBackground />
            </Suspense>
          </div>
          {/* Slightly darker veil than the WebGL path (0.32 vs 0.22).
              The CSS gradient blobs are flatter than the WebGL bloom
              and need a touch more contrast on top to keep text and
              CTAs as readable here as they are over the real tubes.
              See replit.md rule #8 for the rationale. */}
          <div
            className="fixed inset-0 z-[1] pointer-events-none"
            aria-hidden="true"
            data-testid="tubes-fallback-veil"
            style={{
              background: "rgba(5,5,5,0.32)",
              opacity: "var(--tubes-reveal-opacity, 1)",
            }}
          />
        </>
      )}
      <div
        className="fixed top-0 left-0 z-[100] h-[3px] pointer-events-none"
        style={{
          width: `${scrollProgress * 100}%`,
          background: "linear-gradient(90deg, #f59e0b, #d97706, #b45309)",
          transition: "width 0.1s linear",
          boxShadow: "0 0 8px rgba(245, 158, 11, 0.6), 0 0 20px rgba(245, 158, 11, 0.3)",
        }}
        data-testid="scroll-progress-indicator"
      />

      <header
        className={cn(
          "fixed top-0 z-50 w-full transition-all duration-500 ease-out",
          headerTransparent
            ? "bg-transparent"
            : hasTransparentHeader
              ? "bg-black/60 backdrop-blur-xl"
              : "bg-background/95 backdrop-blur-md shadow-sm"
        )}
      >
        <div
          className={cn(
            "container mx-auto px-4 flex items-center justify-between transition-all duration-500 ease-out",
            scrolled ? "h-16" : "h-20"
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="flex items-center gap-2 group flex-shrink-0">
              <AnimatedLogo
                src={activeLogo}
                alt="Hsquare Living"
                className={cn(
                  "w-auto object-contain transition-all duration-500",
                  scrolled ? "h-10" : "h-12"
                )}
              />
            </Link>

            {/* Glassmorphism Hotels switcher — sits next to the logo, never overlaps nav */}
            <Link
              href="/hotels"
              className={cn(
                "hidden lg:flex items-center gap-2 px-3.5 py-1.5 rounded-full transition-all duration-300 hover:scale-105 group flex-shrink-0",
                "border backdrop-blur-xl"
              )}
              style={{
                background: "rgba(197, 160, 89, 0.12)",
                borderColor: "rgba(197, 160, 89, 0.35)",
                boxShadow: "0 8px 24px rgba(197, 160, 89, 0.15), inset 0 1px 0 rgba(255,255,255,0.08)",
              }}
              data-testid="link-hotels-switcher"
            >
              <Star className="w-3.5 h-3.5" style={{ color: "#c5a059" }} fill="#c5a059" />
              <span className="text-[11px] font-semibold tracking-[0.16em] uppercase whitespace-nowrap" style={{ color: "#e9d5a3" }}>
                Switch to Hotels
              </span>
              <span className="text-[10px] opacity-70 group-hover:translate-x-0.5 transition-transform" style={{ color: "#c5a059" }}>
                →
              </span>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "text-sm font-medium transition-all duration-300 flex items-center gap-2 relative group",
                  headerTransparent
                    ? "text-white/90 hover:text-white"
                    : hasTransparentHeader
                      ? (location === item.href ? "text-amber-400 font-bold" : "text-white/70 hover:text-white")
                      : (location === item.href ? "text-primary font-bold" : "text-muted-foreground hover:text-primary")
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
                <span className={cn(
                  "absolute -bottom-1 left-0 h-[2px] bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-300",
                  location === item.href ? "w-full" : "w-0 group-hover:w-full"
                )} />
              </Link>
            ))}
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className={cn(
                "p-2 rounded-full transition-all duration-300",
                searchOpen
                  ? "bg-amber-600 text-white shadow-[0_0_15px_rgba(245,158,11,0.4)]"
                  : headerTransparent
                    ? "text-white/80 hover:text-white hover:bg-white/10"
                    : hasTransparentHeader
                      ? "text-white/70 hover:text-white hover:bg-white/10"
                      : "text-muted-foreground hover:text-primary hover:bg-muted"
              )}
              data-testid="button-search-toggle"
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
            </button>
            <div className={cn("pl-4 border-l", headerTransparent ? "border-white/20" : hasTransparentHeader ? "border-white/10" : "border-border")}>
              <ProfileDropdown />
            </div>
          </nav>

          <div className="md:hidden flex items-center gap-1">
            <Link
              href="/hotels"
              className="px-3 py-1.5 rounded-full border backdrop-blur-xl flex items-center gap-1.5 mr-1"
              style={{
                background: "rgba(197, 160, 89, 0.12)",
                borderColor: "rgba(197, 160, 89, 0.35)",
              }}
              data-testid="link-hotels-switcher-mobile"
            >
              <Star className="w-3 h-3" style={{ color: "#c5a059" }} fill="#c5a059" />
              <span className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: "#e9d5a3" }}>
                Hotels
              </span>
            </Link>
            <button
              className={cn("p-2 rounded-full transition-colors",
                headerTransparent || hasTransparentHeader ? "text-white hover:bg-white/10" : "text-muted-foreground hover:bg-muted"
              )}
              onClick={() => { setSearchOpen(!searchOpen); setMobileMenuOpen(false); }}
              data-testid="button-search-toggle-mobile"
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>
            <button
              className={cn(
                "p-2 transition-all duration-300 relative z-[60]",
                headerTransparent || hasTransparentHeader ? "text-white" : "text-foreground"
              )}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-[55] bg-black/95 backdrop-blur-2xl flex flex-col" style={{ top: 0 }}>
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {Array.from({ length: 30 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute rounded-full bg-amber-400/20"
                  style={{
                    width: `${Math.random() * 3 + 1}px`,
                    height: `${Math.random() * 3 + 1}px`,
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animation: `float ${Math.random() * 6 + 4}s ease-in-out infinite`,
                    animationDelay: `${Math.random() * 3}s`,
                    opacity: Math.random() * 0.5 + 0.2,
                  }}
                />
              ))}
            </div>

            <div className="flex-1 flex flex-col justify-center items-center gap-2 px-8" style={{ paddingTop: "5rem" }}>
              {navItems.map((item, index) => (
                <Link 
                  key={item.href} 
                  href={item.href}
                  className={cn(
                    "text-2xl font-bold transition-all duration-500 flex items-center gap-4 p-4 rounded-xl w-full max-w-sm",
                    "opacity-0 translate-y-8",
                    location === item.href
                      ? "text-amber-400 bg-amber-400/10"
                      : "text-white/80 hover:text-white hover:bg-white/5"
                  )}
                  style={{
                    animation: `mobileMenuItemReveal 0.5s ease-out ${index * 0.1}s forwards`,
                  }}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center",
                    location === item.href ? "bg-amber-400/20" : "bg-white/5"
                  )}>
                    <item.icon className="w-6 h-6" />
                  </div>
                  {item.name}
                </Link>
              ))}
              <div
                className="w-full max-w-sm mt-4 opacity-0 translate-y-8"
                style={{
                  animation: `mobileMenuItemReveal 0.5s ease-out ${navItems.length * 0.1}s forwards`,
                }}
              >
                {!user ? (
                  <button
                    onClick={() => { setMobileMenuOpen(false); openAuthModal("access your account"); }}
                    className="w-full flex items-center gap-4 p-4 rounded-xl text-2xl font-bold text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 transition-all duration-300"
                    data-testid="button-sign-in-mobile"
                  >
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-400/20">
                      <User className="w-6 h-6" />
                    </div>
                    Sign In
                  </button>
                ) : (
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-400/20 text-amber-400 font-bold text-lg">
                      {user.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold truncate">{user.name}</p>
                      <p className="text-white/50 text-sm truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={() => { setMobileMenuOpen(false); logout(); }}
                      className="p-2 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors"
                      data-testid="button-logout-mobile-menu"
                    >
                      <LogOut className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
              <div
                className="w-full max-w-sm mt-6 pt-6 border-t border-white/10 opacity-0 translate-y-8"
                style={{
                  animation: `mobileMenuItemReveal 0.5s ease-out ${(navItems.length + (user ? 0 : 1)) * 0.1}s forwards`,
                }}
              >
                <SmartSearch
                  onSearchResults={handleSearchResults}
                  placeholder="Search properties, locations..."
                  className="[&_input]:h-12 [&_input]:bg-white/10 [&_input]:border-white/20 [&_input]:text-white [&_input]:placeholder:text-white/50 [&_input]:rounded-xl"
                />
              </div>
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

      {!hasTransparentHeader && <div className={cn("transition-all duration-500", scrolled ? "h-16" : "h-20")} />}

      <main className="flex-1 w-full relative z-10">
        <PullToRefresh>
          {children}
        </PullToRefresh>
      </main>

      {/* footer + close moved below; provider closes after the outer div */}

      <footer className="bg-stone-900/85 backdrop-blur-md text-stone-300 relative z-10" data-testid="site-footer">
        <div className="container mx-auto px-6 pt-16 pb-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-6">
            <div className="md:col-span-3 space-y-5">
              <p className="text-sm text-stone-400 leading-relaxed max-w-xs">
                {footer.companyDescription}
              </p>
              <div className="flex items-center gap-3">
                <img src={activeFooterLogo} alt="Hsquare Living" className="h-12 w-auto object-contain brightness-0 invert" />
              </div>
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

            <div className="md:col-span-2">
              <h4 className="font-heading font-bold text-white text-sm uppercase tracking-widest mb-5">Hostels Near</h4>
              <ul className="space-y-3">
                {[
                  { label: "NMIMS University", href: "/hostel-near-nmims" },
                  { label: "Mithibai College", href: "/hostel-near-mithibai" },
                  { label: "Mukesh Patel", href: "/hostel-near-mukesh-patel" },
                  { label: "NM College", href: "/hostel-near-nm-college" },
                  { label: "DJ Sanghvi", href: "/hostel-near-dj-sanghvi" },
                  { label: "Whistling Woods", href: "/hostel-near-whistling-woods" },
                  { label: "Vile Parle", href: "/hostel-in-vile-parle" },
                  { label: "Goregaon", href: "/hostel-in-goregaon" },
                ].map((link, i) => (
                  <li key={i}>
                    <Link href={link.href} className="text-sm text-stone-400 hover:text-amber-400 transition-colors duration-200 flex items-center gap-1.5 group">
                      <ArrowUpRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                      <span>{link.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="md:col-span-3">
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

              <div className="mt-6 pt-5 border-t border-stone-800">
                <h4 className="font-heading font-bold text-white text-xs uppercase tracking-widest mb-3">Download Our App</h4>
                <div className="flex flex-col gap-2">
                  <a
                    href="https://apps.apple.com/in/app/hsquareconnect-app/id6759179340"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-3 px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-stone-600 transition-all duration-200 group"
                    data-testid="link-app-store-footer"
                  >
                    <svg className="w-6 h-6 text-stone-300 group-hover:text-white transition-colors" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                    <div>
                      <p className="text-[10px] text-stone-500 leading-none">Download on the</p>
                      <p className="text-sm font-semibold text-stone-200 group-hover:text-white transition-colors leading-tight">App Store</p>
                    </div>
                  </a>
                  {footer.androidDownloadUrl && (
                    <a
                      href={footer.androidDownloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-3 px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-stone-600 transition-all duration-200 group"
                      data-testid="link-android-download-footer"
                    >
                      <svg className="w-6 h-6 text-emerald-400 group-hover:text-emerald-300 transition-colors" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.523 15.3414c-.5 0-.9.4-.9.9v4.3c0 .5-.4.9-.9.9h-7.8c-.5 0-.9-.4-.9-.9v-4.3c0-.5-.4-.9-.9-.9s-.9.4-.9.9v4.3c0 1.5 1.2 2.7 2.7 2.7h7.8c1.5 0 2.7-1.2 2.7-2.7v-4.3c0-.5-.4-.9-.9-.9z"/>
                        <path d="M11.323 17.6414c.1.1.3.2.5.2h.4c.2 0 .3-.1.5-.2l3.6-3.6c.4-.4.4-.9 0-1.3s-.9-.4-1.3 0l-2 2v-11.7c0-.5-.4-.9-.9-.9s-.9.4-.9.9v11.7l-2-2c-.4-.4-.9-.4-1.3 0s-.4.9 0 1.3z"/>
                      </svg>
                      <div>
                        <p className="text-[10px] text-stone-500 leading-none">Download for</p>
                        <p className="text-sm font-semibold text-stone-200 group-hover:text-white transition-colors leading-tight">Android</p>
                      </div>
                    </a>
                  )}
                </div>
              </div>
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

      <style>{`
        @keyframes mobileMenuItemReveal {
          from {
            opacity: 0;
            transform: translateY(2rem);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          25% { transform: translateY(-10px) translateX(5px); }
          50% { transform: translateY(-5px) translateX(-3px); }
          75% { transform: translateY(-15px) translateX(2px); }
        }
      `}</style>
    </div>
    </TubesContext.Provider>
  );
}
