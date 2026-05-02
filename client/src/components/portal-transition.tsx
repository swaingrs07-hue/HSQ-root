import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import hsquareLogo from "@/assets/hsquare-logo-full.png";

type Direction = "to-hotels" | "to-hostel";

interface PortalTransitionContextValue {
  switchTo: (dir: Direction, href: string) => void;
}

const PortalTransitionContext = createContext<PortalTransitionContextValue | null>(null);

export function usePortalSwitch() {
  const ctx = useContext(PortalTransitionContext);
  if (!ctx) {
    return (_dir: Direction, href: string) => {
      window.location.href = href;
    };
  }
  return ctx.switchTo;
}

const ENTER_MS = 520;
const HOLD_MS = 320;
const EXIT_MS = 480;

export function PortalTransitionProvider({ children }: { children: React.ReactNode }) {
  const [, navigate] = useLocation();
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState<"enter" | "exit">("enter");
  const [direction, setDirection] = useState<Direction>("to-hotels");
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
    };
  }, []);

  const switchTo = useCallback(
    (dir: Direction, href: string) => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];

      setDirection(dir);
      setPhase("enter");
      setActive(true);
      document.body.style.overflow = "hidden";

      const t1 = window.setTimeout(() => {
        navigate(href);
        window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      }, ENTER_MS);

      const t2 = window.setTimeout(() => {
        setPhase("exit");
      }, ENTER_MS + HOLD_MS);

      const t3 = window.setTimeout(() => {
        setActive(false);
        document.body.style.overflow = "";
      }, ENTER_MS + HOLD_MS + EXIT_MS);

      timersRef.current = [t1, t2, t3];
    },
    [navigate],
  );

  const isHotels = direction === "to-hotels";
  const headline = isHotels ? "Welcome to Hsquare Hotels" : "Welcome back to Hsquare Living";
  const sub = isHotels ? "Curating your luxury stay" : "Returning to student living";

  return (
    <PortalTransitionContext.Provider value={{ switchTo }}>
      {children}
      {active && (
        <div
          className="fixed inset-0 z-[9999] pointer-events-none"
          aria-hidden
          data-testid="portal-transition-overlay"
          data-direction={direction}
          data-phase={phase}
        >
          <style>{`
            @keyframes portalFadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes portalFadeOut {
              from { opacity: 1; }
              to { opacity: 0; }
            }
            @keyframes portalSweepIn {
              from { transform: scaleX(0); transform-origin: left center; }
              to { transform: scaleX(1); transform-origin: left center; }
            }
            @keyframes portalSweepOut {
              from { transform: scaleX(1); transform-origin: right center; }
              to { transform: scaleX(0); transform-origin: right center; }
            }
            @keyframes portalLogoIn {
              0% { opacity: 0; transform: translateY(14px) scale(0.96); filter: blur(6px); }
              60% { opacity: 1; filter: blur(0); }
              100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
            }
            @keyframes portalShimmer {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(100%); }
            }
            @keyframes portalLineExpand {
              from { width: 0; opacity: 0; }
              to { width: 80px; opacity: 1; }
            }
            .portal-overlay-base {
              animation: ${phase === "enter" ? "portalFadeIn" : "portalFadeOut"} ${phase === "enter" ? ENTER_MS : EXIT_MS}ms cubic-bezier(0.65, 0, 0.35, 1) forwards;
            }
            .portal-sweep {
              animation: ${phase === "enter" ? "portalSweepIn" : "portalSweepOut"} ${phase === "enter" ? ENTER_MS : EXIT_MS}ms cubic-bezier(0.83, 0, 0.17, 1) forwards;
            }
            .portal-logo-in {
              animation: portalLogoIn 700ms cubic-bezier(0.16, 1, 0.3, 1) both;
              animation-delay: 120ms;
            }
            .portal-line {
              animation: portalLineExpand 600ms cubic-bezier(0.16, 1, 0.3, 1) both;
              animation-delay: 240ms;
            }
            .portal-shimmer-track {
              position: absolute;
              inset: 0;
              overflow: hidden;
              opacity: 0.7;
            }
            .portal-shimmer-bar {
              position: absolute;
              top: 0;
              left: 0;
              height: 100%;
              width: 40%;
              background: linear-gradient(90deg, transparent, rgba(197,160,89,0.18), transparent);
              animation: portalShimmer 1100ms cubic-bezier(0.65, 0, 0.35, 1) infinite;
            }
          `}</style>

          {/* Solid base wash — covers the whole viewport so the route swap underneath is invisible */}
          <div
            className="absolute inset-0 portal-overlay-base"
            style={{
              background: isHotels
                ? "radial-gradient(ellipse at center, #1a1208 0%, #050505 70%)"
                : "radial-gradient(ellipse at center, #0a0a0a 0%, #000 70%)",
            }}
          />

          {/* Gold sweep band — wipes across the screen */}
          <div className="absolute inset-0 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 right-0 portal-sweep"
              style={{
                background: isHotels
                  ? "linear-gradient(90deg, rgba(197,160,89,0.0) 0%, rgba(197,160,89,0.18) 50%, rgba(197,160,89,0.0) 100%)"
                  : "linear-gradient(90deg, rgba(255,255,255,0.0) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.0) 100%)",
              }}
            />
          </div>

          {/* Subtle moving shimmer */}
          {isHotels && (
            <div className="portal-shimmer-track">
              <div className="portal-shimmer-bar" />
            </div>
          )}

          {/* Centered brand mark */}
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <div className="portal-logo-in flex flex-col items-center">
              <img
                src={hsquareLogo}
                alt="Hsquare"
                className="h-12 sm:h-14 w-auto object-contain"
                style={{
                  filter: isHotels ? "brightness(0) invert(1)" : "brightness(0) invert(1)",
                }}
              />
              <div
                className="portal-line h-px mt-6 mb-5"
                style={{ backgroundColor: isHotels ? "#c5a059" : "rgba(255,255,255,0.5)" }}
              />
              <p
                className="text-[10px] sm:text-[11px] uppercase tracking-[0.4em] mb-2"
                style={{ color: isHotels ? "#c5a059" : "rgba(255,255,255,0.6)" }}
                data-testid="text-portal-sub"
              >
                {sub}
              </p>
              <h2
                className="text-base sm:text-lg font-medium tracking-wide text-white"
                data-testid="text-portal-headline"
              >
                {headline}
              </h2>
            </div>
          </div>
        </div>
      )}
    </PortalTransitionContext.Provider>
  );
}
