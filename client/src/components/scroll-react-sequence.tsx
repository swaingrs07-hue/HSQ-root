import { useEffect, useRef } from "react";
import { useSiteContent } from "@/hooks/use-site-content";

const FRAME_COUNT = 240;
const BASE = (import.meta as any).env?.BASE_URL ?? "/";

function framePath(i: number) {
  const n = String(i + 1).padStart(3, "0");
  return `${BASE}scrollreact/ezgif-frame-${n}.jpg`;
}

function easeInOutQuint(t: number) {
  return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
}

export interface ScrollReactSequenceProps {
  eyebrow?: string;
  titleLine1?: string;
  titleAccent?: string;
}

interface ScrollReactContent {
  eyebrow: string;
  titleLine1: string;
  titleAccent: string;
  videoUrl?: string;
}

const DEFAULT_CONTENT: ScrollReactContent = {
  eyebrow: "The Experience",
  titleLine1: "Every Frame,",
  titleAccent: "Every Stay",
  videoUrl: "",
};

/**
 * Cinematic scroll-driven section. Two source modes:
 *   1) Default: 240 JPGs in /scrollreact/ rendered to a canvas, scrubbed by
 *      scroll position with rAF throttling.
 *   2) Custom video: when superadmin sets `videoUrl` on the
 *      `hotels_scrollreact` site-content key, the canvas is replaced by an
 *      autoplaying muted loop of that file.
 * All copy is editable by superadmin via the `hotels_scrollreact` key.
 */
export function ScrollReactSequence(props: ScrollReactSequenceProps) {
  const { getContent } = useSiteContent();
  const stored = getContent<ScrollReactContent>("hotels_scrollreact", DEFAULT_CONTENT);
  const eyebrow = props.eyebrow ?? stored.eyebrow;
  const titleLine1 = props.titleLine1 ?? stored.titleLine1;
  const titleAccent = props.titleAccent ?? stored.titleAccent;
  const videoUrl = (stored.videoUrl ?? "").trim();
  const useVideo = videoUrl.length > 0;

  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const lastDrawnRef = useRef(-1);
  const targetIdxRef = useRef(0);

  const drawFrame = (idx: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let pickIdx = -1;
    for (let i = idx; i >= 0; i--) {
      const im = imagesRef.current[i];
      if (im && im.complete && im.naturalWidth > 0) {
        pickIdx = i;
        break;
      }
    }
    if (pickIdx === -1) {
      for (let i = idx + 1; i < FRAME_COUNT; i++) {
        const im = imagesRef.current[i];
        if (im && im.complete && im.naturalWidth > 0) {
          pickIdx = i;
          break;
        }
      }
    }
    if (pickIdx === -1) return;
    const img = imagesRef.current[pickIdx];
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(1.25, window.devicePixelRatio || 1);
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (cw === 0 || ch === 0) return;
    const targetW = Math.floor(cw * dpr);
    const targetH = Math.floor(ch * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    const cr = canvas.width / canvas.height;
    const ir = img.naturalWidth / img.naturalHeight;
    let dw, dh, dx, dy;
    if (ir > cr) {
      dh = canvas.height;
      dw = dh * ir;
      dx = (canvas.width - dw) / 2;
      dy = 0;
    } else {
      dw = canvas.width;
      dh = dw / ir;
      dx = 0;
      dy = (canvas.height - dh) / 2;
    }
    ctx.drawImage(img, dx, dy, dw, dh);
    lastDrawnRef.current = idx;
  };

  // Preload all frames (skipped when superadmin uploaded a video)
  useEffect(() => {
    if (useVideo) return;
    const imgs: HTMLImageElement[] = [];
    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image();
      img.src = framePath(i);
      img.onload = () => {
        const target = targetIdxRef.current;
        if (Math.abs(i - target) <= 5 || lastDrawnRef.current < 0) {
          drawFrame(target);
        }
      };
      imgs.push(img);
    }
    imagesRef.current = imgs;
  }, [useVideo]);

  useEffect(() => {
    if (useVideo) return;
    let raf = 0;
    let scheduled = false;
    let lastIdx = -1;
    let lastVisible: boolean | null = null;
    const root = document.documentElement;
    const headline = headlineRef.current;

    const tick = () => {
      scheduled = false;
      const sec = sectionRef.current;
      const overlay = overlayRef.current;
      if (!sec || !overlay) return;
      const rect = sec.getBoundingClientRect();
      const total = sec.offsetHeight;

      let cp: number;
      if (rect.top > 0) cp = 0;
      else if (rect.bottom <= 0) cp = 1;
      else {
        const cardStart = total * 0.6;
        const cardEnd = total * 0.96;
        const raw = Math.min(
          1,
          Math.max(0, (-rect.top - cardStart) / Math.max(1, cardEnd - cardStart)),
        );
        cp = easeInOutQuint(raw);
      }
      root.style.setProperty("--scrollreact-card", String(cp));
      const cover = Math.max(0, Math.round(rect.bottom));
      root.style.setProperty("--scrollreact-cover", `${cover}px`);

      const inRange = rect.top <= 0 && rect.bottom > 0;
      if (inRange !== lastVisible) {
        overlay.style.opacity = inRange ? "1" : "0";
        overlay.style.visibility = inRange ? "visible" : "hidden";
        lastVisible = inRange;
      }
      if (!inRange) return;

      const playRange = total * 0.58;
      const progress = Math.min(1, Math.max(0, -rect.top / Math.max(1, playRange)));
      const idx = Math.min(
        FRAME_COUNT - 1,
        Math.max(0, Math.round(progress * (FRAME_COUNT - 1))),
      );
      targetIdxRef.current = idx;
      if (idx !== lastIdx) {
        lastIdx = idx;
        if (!useVideo) drawFrame(idx);
      }
      if (headline) {
        const textOut = Math.min(1, Math.max(0, (progress - 0.75) / 0.25));
        headline.style.setProperty("--sr-progress", progress.toFixed(3));
        headline.style.setProperty("--sr-textOut", textOut.toFixed(3));
      }
    };

    const onScroll = () => {
      if (scheduled) return;
      scheduled = true;
      raf = requestAnimationFrame(tick);
    };
    const onResize = () => {
      lastIdx = -1;
      onScroll();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, [useVideo]);

  /* VIDEO MODE — single-screen section, one <video>, no scroll-pin, no rAF.
     This avoids the lag caused by the 320vh sticky overlay + double-decoded
     video that the frame-sequence layout was originally built for. */
  if (useVideo) {
    return (
      <section
        ref={sectionRef}
        className="relative bg-black overflow-hidden"
        style={{ minHeight: "100vh" }}
        data-testid="section-scroll-react-sequence"
      >
        <video
          src={videoUrl}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          data-testid="video-scrollreact"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/15 to-black/75" />
        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center text-center px-6 lg:px-12 py-24">
          <span
            className="px-4 py-1.5 rounded-full bg-black/55 backdrop-blur-md border border-white/15 text-[11px] uppercase tracking-[0.35em] mb-6"
            style={{ color: "#c5a059" }}
            data-testid="text-scrollreact-eyebrow"
          >
            {eyebrow}
          </span>
          <h2
            className="hotels-display text-white text-4xl sm:text-5xl md:text-7xl lg:text-8xl max-w-4xl leading-[0.95]"
            style={{ textShadow: "0 6px 30px rgba(0,0,0,0.85)" }}
            data-testid="text-scrollreact-title"
          >
            {titleLine1} <span style={{ color: "#c5a059" }}>{titleAccent}</span>
          </h2>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      className="relative bg-black"
      style={{ height: "320vh" }}
      data-testid="section-scroll-react-sequence"
    >
      {/* Static first frame so the section looks alive before scroll lock */}
      <div className="absolute top-0 left-0 w-full h-screen overflow-hidden">
        <img
          src={framePath(0)}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/10 to-black/70" />
        <div className="absolute inset-x-0 top-0 pt-24 px-6 lg:px-12 flex flex-col items-center gap-4">
          <span
            className="px-4 py-1.5 rounded-full bg-black/55 backdrop-blur-md border border-white/15 text-[11px] uppercase tracking-[0.35em]"
            style={{ color: "#c5a059" }}
            data-testid="text-scrollreact-eyebrow-static"
          >
            {eyebrow}
          </span>
          <h2
            className="hotels-display text-white text-4xl sm:text-5xl md:text-7xl lg:text-8xl max-w-4xl text-center leading-[0.95]"
            style={{ textShadow: "0 6px 30px rgba(0,0,0,0.85)" }}
          >
            {titleLine1} <span style={{ color: "#c5a059" }}>{titleAccent}</span>
          </h2>
        </div>
      </div>

      {/* Sticky canvas overlay — fixed-position, opacity toggled imperatively */}
      <div
        ref={overlayRef}
        className="fixed inset-0 z-30 pointer-events-none"
        style={{
          opacity: 0,
          visibility: "hidden",
          willChange: "opacity",
          transform: "translateZ(0)",
        }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full bg-black" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/10 to-black/70" />
        <div className="absolute inset-x-0 top-0 pt-24 px-6 lg:px-12 flex flex-col items-center">
          <div ref={headlineRef} className="sr-headline max-w-4xl text-center">
            <span
              className="sr-eyebrow px-4 py-1.5 rounded-full bg-black/55 backdrop-blur-md border border-white/15 text-[11px] uppercase font-bold"
              style={{ color: "#c5a059" }}
              data-testid="text-scrollreact-eyebrow"
            >
              {eyebrow}
            </span>
            <h2
              className="hotels-display text-white leading-[0.95] mt-5 text-4xl sm:text-5xl md:text-7xl lg:text-8xl"
              style={{ textShadow: "0 6px 30px rgba(0,0,0,0.85)" }}
              data-testid="text-scrollreact-title"
            >
              <AnimatedHeadline line1={titleLine1} accent={titleAccent} />
            </h2>
          </div>
        </div>
      </div>
    </section>
  );
}

function AnimatedHeadline({ line1, accent }: { line1: string; accent: string }) {
  const words1 = line1.trim().split(/\s+/).filter(Boolean);
  const words2 = accent.trim().split(/\s+/).filter(Boolean);
  let i = 0;
  return (
    <span className="sr-line">
      {words1.map((w) => (
        <span key={`a-${i}-${w}`} className="sr-word" style={{ ["--i" as any]: i++ }}>
          {w}
        </span>
      ))}
      {words2.map((w) => (
        <span
          key={`b-${i}-${w}`}
          className="sr-word sr-word--accent"
          style={{ ["--i" as any]: i++ }}
        >
          {w}
        </span>
      ))}
    </span>
  );
}
