import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface HsquareLoadingScreenProps {
  ready: boolean;
  onComplete: () => void;
}

const MIN_HOLD_MS = 2000;
const SAFETY_CAP_MS = 10000;
const EXPECTED_LOAD_MS = 6000;
const EXIT_DURATION_MS = 1400;

export function HsquareLoadingScreen({
  ready,
  onComplete,
}: HsquareLoadingScreenProps) {
  const [phase, setPhase] = useState<"loading" | "exiting" | "done">("loading");
  const [percent, setPercent] = useState(0);
  const startRef = useRef(performance.now());
  const completedRef = useRef(false);

  const prefersReduced =
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!prefersReduced) return;
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [prefersReduced, onComplete]);

  useEffect(() => {
    if (prefersReduced) return;
    if (phase === "done") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [prefersReduced, phase]);

  useEffect(() => {
    if (prefersReduced) return;
    if (phase !== "loading") return;
    let raf = 0;
    let settleTimer = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const elapsed = performance.now() - startRef.current;
      const safetyHit = elapsed >= SAFETY_CAP_MS;
      const minHoldDone = elapsed >= MIN_HOLD_MS;
      const isReady = (ready || safetyHit) && minHoldDone;

      let target: number;
      if (isReady) {
        target = 100;
      } else {
        const t = Math.min(elapsed / EXPECTED_LOAD_MS, 1);
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        target = Math.min(eased * 92, 92);
      }

      setPercent((prevPct) => {
        const delta = target - prevPct;
        const next = prevPct + delta * 0.18;
        return Math.abs(target - next) < 0.1 ? target : next;
      });

      if (isReady) {
        // Brief 250ms settle so the user actually sees 100% before
        // the zoom-in exit kicks in. Tracked so we can cancel on
        // unmount and avoid an orphaned setState.
        settleTimer = window.setTimeout(() => {
          if (cancelled) return;
          setPercent(100);
          setPhase("exiting");
        }, 250);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (settleTimer) window.clearTimeout(settleTimer);
    };
  }, [phase, ready, prefersReduced]);

  useEffect(() => {
    if (phase !== "exiting") return;
    const t = window.setTimeout(() => {
      setPhase("done");
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete();
      }
    }, EXIT_DURATION_MS);
    return () => window.clearTimeout(t);
  }, [phase, onComplete]);

  if (prefersReduced || phase === "done") return null;
  if (typeof document === "undefined" || !document.body) return null;

  const exiting = phase === "exiting";
  const displayPercent = Math.min(100, Math.max(0, Math.floor(percent)));

  // Render via a portal to document.body so the overlay escapes any
  // ancestor stacking contexts (e.g. Layout's <main className="relative
  // z-10">) and reliably covers the fixed header. Without this, the
  // overlay would visually sit BEHIND the header even at z-9999.
  return createPortal(
    <div
      className="hsq-loading-overlay"
      data-testid="hsquare-loading-screen"
      role="progressbar"
      aria-label="Loading Hsquare Living"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={displayPercent}
    >
      <style>{`
        .hsq-loading-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: #000000;
          font-family: 'Manrope', sans-serif;
          overflow: hidden;
          perspective: 1000px;
        }
        .hsq-loading-inner {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          position: relative;
        }
        .hsq-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1.5rem;
          transform-origin: center center;
        }
        .hsq-content.hsq-content-exit {
          animation: hsqFinalZoomIn 1.4s cubic-bezier(0.7, 0, 0.3, 1) forwards;
        }
        .hsq-title {
          font-family: 'Manrope', sans-serif;
          font-size: clamp(4rem, 12vw, 5.5rem);
          font-weight: 900;
          letter-spacing: -0.04em;
          text-align: center;
          line-height: 1;
          opacity: 0;
          animation: hsqFadeInScale 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          animation-delay: 0.3s;
          max-width: 98%;
          word-spacing: 0.15em;
          background: linear-gradient(135deg, #ffffff 0%, #b41d43 50%, #06b6d4 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          color: transparent;
          margin: 0;
        }
        .hsq-percent {
          font-family: 'Manrope', sans-serif;
          font-size: clamp(2rem, 5vw, 3rem);
          font-weight: 900;
          color: #b41d43;
          text-align: center;
          letter-spacing: -0.03em;
          opacity: 0;
          animation: hsqFadeIn 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          animation-delay: 0.8s;
          min-width: 180px;
          font-variant-numeric: tabular-nums;
        }
        .hsq-progress {
          position: absolute;
          bottom: 60px;
          left: 50%;
          transform: translateX(-50%);
          width: 280px;
          height: 2px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
          overflow: hidden;
          opacity: 0;
          animation: hsqFadeIn 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          animation-delay: 1s;
        }
        .hsq-progress.hsq-progress-exit {
          animation: hsqFadeOut 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          animation-delay: 0s;
        }
        .hsq-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #b41d43, #06b6d4);
          border-radius: 2px;
          box-shadow: 0 0 10px rgba(180, 29, 67, 0.4), 0 0 5px rgba(6, 182, 212, 0.2);
          transition: width 0.18s linear;
        }
        .hsq-accent {
          position: absolute;
          background: linear-gradient(90deg, transparent, #b41d43, transparent);
          opacity: 0;
          pointer-events: none;
          left: 50%;
          height: 1px;
          width: 0;
          transform: translateX(-50%);
          animation: hsqExpandWidth 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
        .hsq-accent-top {
          top: 40px;
          animation-delay: 0.2s;
        }
        .hsq-accent-bottom {
          bottom: 120px;
          animation-delay: 1s;
        }
        @keyframes hsqFadeInScale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes hsqFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes hsqFadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes hsqExpandWidth {
          from { opacity: 0; width: 0; }
          to { opacity: 0.2; width: min(100%, 120px); }
        }
        /*
         * Splash exit zoom.
         *
         * Original version animated to scale(30) translateZ(2000px)
         * with rotateX/rotateY/blur(20px). On Windows-Chrome that
         * combination forced the whole overlay onto a non-accelerated
         * compositor path: the giant scale() inflated the texture
         * source past GPU upload limits, the blur() filter on a full-
         * screen layer kicked the renderer into software, and the
         * 3D rotates added a perspective transform on top. Result was
         * a 600-1000ms freeze right when the page was supposed to
         * reveal — the "loading lag" the user reported.
         *
         * Current version is a simple scale + fade that stays inside
         * the GPU's fast path on every platform. No filter, no
         * perspective rotate, no translateZ. Visually this still reads
         * as "the title zooms forward and dissolves" — the user only
         * loses the very last bit of motion blur, which Windows wasn't
         * able to render smoothly anyway.
         *
         * Windows additionally short-circuits this to a pure fade via
         * the [data-platform="windows"] override below, so even the
         * 5x scale doesn't have to happen there.
         */
        @keyframes hsqFinalZoomIn {
          0%   { transform: scale(1);    opacity: 1; }
          100% { transform: scale(5);    opacity: 0; }
        }
        @keyframes hsqFinalFadeOut {
          0%   { transform: scale(1);    opacity: 1; }
          100% { transform: scale(1.08); opacity: 0; }
        }
        :root[data-platform="windows"] .hsq-content.hsq-content-exit {
          animation: hsqFinalFadeOut 0.6s ease-out forwards !important;
        }
        :root[data-platform="windows"] .hsq-progress.hsq-progress-exit {
          animation-duration: 0.4s !important;
        }
        @media (max-width: 768px) {
          .hsq-loading-inner { padding: 30px 20px; }
          .hsq-title { font-size: clamp(2.8rem, 10vw, 4rem); }
          .hsq-percent { font-size: clamp(1.8rem, 5vw, 2.5rem); min-width: 140px; }
          .hsq-progress { width: 90%; max-width: 280px; }
        }
      `}</style>
      <div className="hsq-loading-inner">
        <div className="hsq-accent hsq-accent-top" aria-hidden="true" />
        <div
          className={`hsq-content${exiting ? " hsq-content-exit" : ""}`}
        >
          <h1 className="hsq-title">HSQUARE LIVING</h1>
          <div className="hsq-percent" data-testid="text-loading-percent">
            {displayPercent}%
          </div>
        </div>
        <div
          className={`hsq-progress${exiting ? " hsq-progress-exit" : ""}`}
        >
          <div
            className="hsq-progress-fill"
            style={{ width: `${displayPercent}%` }}
            data-testid="bar-loading-progress"
          />
        </div>
        <div className="hsq-accent hsq-accent-bottom" aria-hidden="true" />
      </div>
    </div>,
    document.body,
  );
}
