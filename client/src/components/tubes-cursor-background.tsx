import { useEffect, useRef } from "react";

interface TubesCursorBackgroundProps {
  className?: string;
  enabled?: boolean;
  reduceMotion?: boolean;
  onFailure?: () => void;
}

interface TubesController {
  setColors?: (colors: string[]) => void;
  setLightsColors?: (colors: string[]) => void;
}

interface TubesApp {
  tubes?: TubesController;
  destroy?: () => void;
  pause?: () => void;
  resume?: () => void;
}

type TubesFactory = (
  canvas: HTMLCanvasElement,
  options: {
    tubes: {
      colors: string[];
      lights: { intensity: number; colors: string[] };
    };
  },
) => TubesApp;

type TubesModule = TubesFactory | { default: TubesFactory };

interface NavigatorWithGPU extends Navigator {
  gpu?: unknown;
}

const TUBE_COLORS = ["#ff008a", "#2e6cfe", "#60aed5"];
const LIGHT_COLORS = ["#fe8a2e", "#83f36e", "#ff008a", "#ffffff"];
const CDN_URL =
  "https://cdn.jsdelivr.net/npm/threejs-components@0.0.19/build/cursors/tubes1.min.js";

function getRandomColors(count: number): string[] {
  return new Array(count)
    .fill(0)
    .map(
      () =>
        "#" +
        Math.floor(Math.random() * 16777215)
          .toString(16)
          .padStart(6, "0"),
    );
}

export default function TubesCursorBackground({
  className,
  enabled = true,
  reduceMotion = false,
  onFailure,
}: TubesCursorBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enabled || reduceMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let app: TubesApp | null = null;
    let onClick: ((e: MouseEvent) => void) | null = null;
    let clickTarget: Document | HTMLElement | null = null;
    let visibilityHandler: (() => void) | null = null;
    let onTouchMove: ((e: TouchEvent) => void) | null = null;
    let onTouchStart: ((e: TouchEvent) => void) | null = null;

    const fail = (reason: string, err?: unknown) => {
      console.warn(`[TubesCursor] ${reason}`, err);
      if (onFailure) onFailure();
    };

    // Pre-flight: the lib needs a GPU context. Require WebGL2 or WebGPU.
    let hasWebGL2 = false;
    try {
      hasWebGL2 = !!document.createElement("canvas").getContext("webgl2");
    } catch {
      hasWebGL2 = false;
    }
    const hasWebGPU = !!(navigator as NavigatorWithGPU).gpu;
    if (!hasWebGL2 && !hasWebGPU) {
      fail("no WebGL2/WebGPU context available");
      return;
    }

    // Global error guard: the CDN library occasionally throws during
    // its RAF loop (e.g. WebGL context loss inside iframes/preview
    // environments). Without this, the unhandled error bubbles up to
    // window.onerror and gets surfaced as a workflow failure even
    // though the rest of the page is fine. Catch any error whose
    // stack mentions the tubes script, swallow it, and tear down the
    // background gracefully.
    const isTubesError = (msg: unknown, filename?: string, errStack?: string) => {
      const text = `${typeof msg === "string" ? msg : ""} ${filename || ""} ${errStack || ""}`;
      return text.includes("tubes1.min.js") || text.includes("threejs-components");
    };
    const onWindowError = (e: ErrorEvent) => {
      if (isTubesError(e.message, e.filename, e.error?.stack)) {
        e.preventDefault();
        fail("runtime error from tubes CDN", e.error || e.message);
      }
    };
    const onUnhandledRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason as { message?: string; stack?: string } | undefined;
      if (isTubesError(reason?.message, undefined, reason?.stack)) {
        e.preventDefault();
        fail("unhandled rejection from tubes CDN", reason);
      }
    };
    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    (async () => {
      try {
        const mod = (await import(/* @vite-ignore */ CDN_URL)) as TubesModule;
        if (cancelled || !canvas) return;

        const TubesCursor: TubesFactory =
          typeof mod === "function" ? mod : mod.default;
        if (typeof TubesCursor !== "function") {
          fail("CDN module did not export a function");
          return;
        }

        // Verify the canvas can actually produce a WebGL context BEFORE
        // handing it to the lib. The lib reads getContext("webgl2")
        // internally and if the browser refuses (iframe sandbox,
        // headless, etc.), the lib crashes on getSupportedExtensions.
        const probe = canvas.getContext("webgl2") || canvas.getContext("webgl");
        if (!probe) {
          fail("canvas refused WebGL context");
          return;
        }

        app = TubesCursor(canvas, {
          tubes: {
            colors: TUBE_COLORS,
            lights: { intensity: 300, colors: LIGHT_COLORS },
          },
        });

        canvas.style.opacity = "1";

        // Pause/resume on tab visibility changes to save GPU/battery.
        visibilityHandler = () => {
          if (!app) return;
          const hidden = document.visibilityState === "hidden";
          if (hidden) {
            if (typeof app.pause === "function") app.pause();
            else canvas.style.visibility = "hidden";
          } else {
            if (typeof app.resume === "function") app.resume();
            else canvas.style.visibility = "visible";
          }
        };
        document.addEventListener("visibilitychange", visibilityHandler);

        // Click anywhere on the page randomizes the palette (matches
        // SuperDesign behavior).
        onClick = () => {
          if (!app?.tubes) return;
          app.tubes.setColors?.(getRandomColors(3));
          app.tubes.setLightsColors?.(getRandomColors(4));
        };
        clickTarget = document;
        document.addEventListener("click", onClick);

        // Mobile: forward touch position to the canvas as synthetic
        // pointer events so the tubes follow the user's finger even
        // though the wrapper has pointer-events: none.
        const dispatchPointer = (type: string, t: Touch) => {
          try {
            const evt = new PointerEvent(type, {
              clientX: t.clientX,
              clientY: t.clientY,
              pointerType: "touch",
              bubbles: true,
              cancelable: true,
              isPrimary: true,
            });
            canvas.dispatchEvent(evt);
          } catch {
            const m = new MouseEvent(type === "pointerdown" ? "mousedown" : type === "pointerup" ? "mouseup" : "mousemove", {
              clientX: t.clientX,
              clientY: t.clientY,
              bubbles: true,
              cancelable: true,
            });
            canvas.dispatchEvent(m);
          }
        };
        onTouchStart = (e: TouchEvent) => {
          const t = e.touches[0];
          if (t) dispatchPointer("pointerdown", t);
        };
        onTouchMove = (e: TouchEvent) => {
          const t = e.touches[0];
          if (t) dispatchPointer("pointermove", t);
        };
        document.addEventListener("touchstart", onTouchStart, { passive: true });
        document.addEventListener("touchmove", onTouchMove, { passive: true });
      } catch (err) {
        fail("init failed", err);
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      if (onClick && clickTarget) clickTarget.removeEventListener("click", onClick);
      if (onTouchStart) document.removeEventListener("touchstart", onTouchStart);
      if (onTouchMove) document.removeEventListener("touchmove", onTouchMove);
      if (visibilityHandler) document.removeEventListener("visibilitychange", visibilityHandler);
      if (app && typeof app.destroy === "function") {
        try {
          app.destroy();
        } catch {
          // ignore
        }
      }
      app = null;
    };
  }, [enabled, reduceMotion, onFailure]);

  if (!enabled || reduceMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
        opacity: 0,
        transition: "opacity 1s ease-in",
        touchAction: "none",
        cursor: "pointer",
        transform: "translateZ(0)",
        willChange: "transform",
      }}
      data-testid="canvas-tubes-background"
      aria-hidden="true"
    />
  );
}
