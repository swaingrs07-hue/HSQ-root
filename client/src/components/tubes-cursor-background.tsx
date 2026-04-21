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
    let errorHandler: ((e: ErrorEvent) => void) | null = null;
    let rejHandler: ((e: PromiseRejectionEvent) => void) | null = null;
    let visibilityHandler: (() => void) | null = null;
    let rafId = 0;
    let failed = false;

    const fail = (reason: string, err?: unknown) => {
      if (failed) return;
      failed = true;
      console.warn(`[TubesCursor] ${reason}`, err);
      if (onFailure) onFailure();
    };

    // Pre-flight: the threejs-components lib needs a GPU. We require WebGL2 (the
    // common path on every modern desktop browser); WebGPU is optional and the
    // lib will use it when available.
    let hasWebGL2 = false;
    try {
      const probe = document.createElement("canvas");
      hasWebGL2 = !!probe.getContext("webgl2");
    } catch {
      hasWebGL2 = false;
    }
    const hasWebGPU = !!(navigator as NavigatorWithGPU).gpu;
    if (!hasWebGL2 && !hasWebGPU) {
      fail("no WebGL2/WebGPU context available");
      return;
    }

    // Catch async errors that escape try/catch from inside the CDN bundle's
    // animation loop or context init.
    errorHandler = (e: ErrorEvent) => {
      const msg = String(e?.message || "");
      const src = String(e?.filename || "");
      if (
        src.includes("threejs-components") ||
        msg.includes("getSupportedExtensions") ||
        msg.includes("WebGL") ||
        msg.includes("WebGPU")
      ) {
        e.preventDefault();
        fail("CDN library runtime error", msg);
      }
    };
    window.addEventListener("error", errorHandler);

    rejHandler = (e: PromiseRejectionEvent) => {
      const reason = e?.reason as { message?: string; stack?: string } | undefined;
      const msg = String(reason?.message || reason || "");
      const stack = String(reason?.stack || "");
      if (
        stack.includes("threejs-components") ||
        msg.includes("getSupportedExtensions") ||
        msg.includes("WebGL") ||
        msg.includes("WebGPU")
      ) {
        e.preventDefault();
        fail("CDN library promise rejection", msg);
      }
    };
    window.addEventListener("unhandledrejection", rejHandler);

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

        try {
          app = TubesCursor(canvas, {
            tubes: {
              colors: TUBE_COLORS,
              lights: { intensity: 300, colors: LIGHT_COLORS },
            },
          });
        } catch (initErr) {
          fail("init threw", initErr);
          return;
        }

        if (!app) {
          fail("init returned null");
          return;
        }

        // Reveal canvas after the WebGL/WebGPU context is set up.
        canvas.style.opacity = "1";

        // Pause/resume when the tab is hidden — saves battery and matches the
        // previous wrapper's behavior. Falls back to a no-op rAF spin guard if
        // the lib doesn't expose pause/resume.
        visibilityHandler = () => {
          if (!app) return;
          const hidden = document.visibilityState === "hidden";
          if (hidden) {
            cancelAnimationFrame(rafId);
            if (typeof app.pause === "function") {
              try {
                app.pause();
              } catch {
                // ignore
              }
            } else {
              // Best-effort: hide the canvas to skip GPU work while not visible.
              canvas.style.visibility = "hidden";
            }
          } else {
            if (typeof app.resume === "function") {
              try {
                app.resume();
              } catch {
                // ignore
              }
            } else {
              canvas.style.visibility = "visible";
            }
          }
        };
        document.addEventListener("visibilitychange", visibilityHandler);

        // Click *inside the hero canvas* (not the whole document) randomizes
        // the palette — matches SuperDesign behavior without hijacking clicks
        // on header nav, buttons, etc.
        onClick = () => {
          if (!app?.tubes) return;
          try {
            app.tubes.setColors?.(getRandomColors(3));
            app.tubes.setLightsColors?.(getRandomColors(4));
          } catch (err) {
            console.warn("[TubesCursor] randomize failed:", err);
          }
        };
        canvas.addEventListener("click", onClick);
      } catch (err) {
        fail("failed to load library", err);
      }
    })();

    return () => {
      cancelled = true;
      if (onClick && canvas) canvas.removeEventListener("click", onClick);
      if (errorHandler) window.removeEventListener("error", errorHandler);
      if (rejHandler) window.removeEventListener("unhandledrejection", rejHandler);
      if (visibilityHandler) document.removeEventListener("visibilitychange", visibilityHandler);
      cancelAnimationFrame(rafId);
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
      }}
      data-testid="canvas-tubes-background"
      aria-hidden="true"
    />
  );
}
