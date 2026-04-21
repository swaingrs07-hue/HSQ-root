import { useEffect, useRef } from "react";

interface TubesCursorBackgroundProps {
  className?: string;
  enabled?: boolean;
  reduceMotion?: boolean;
  onFailure?: () => void;
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
    let app: any = null;
    let onClick: ((e: MouseEvent) => void) | null = null;
    let errorHandler: ((e: ErrorEvent) => void) | null = null;
    let rejHandler: ((e: PromiseRejectionEvent) => void) | null = null;
    let failed = false;

    const fail = (reason: string, err?: unknown) => {
      if (failed) return;
      failed = true;
      console.warn(`[TubesCursor] ${reason}`, err);
      if (onFailure) onFailure();
    };

    // Pre-flight: the threejs-components lib uses WebGPURenderer which requires
    // navigator.gpu. Its WebGL2 fallback path is broken in some Chromium builds,
    // so refuse to even try if WebGPU isn't available.
    const hasWebGPU = !!(navigator as any).gpu;
    let hasWebGL2 = false;
    try {
      const probe = document.createElement("canvas");
      hasWebGL2 = !!probe.getContext("webgl2");
    } catch {
      hasWebGL2 = false;
    }
    if (!hasWebGPU || !hasWebGL2) {
      fail(`missing GPU support (webgpu=${hasWebGPU}, webgl2=${hasWebGL2})`);
      return;
    }

    // Catch async errors from the CDN library that escape try/catch
    errorHandler = (e: ErrorEvent) => {
      const msg = String(e?.message || "");
      const src = String((e as any)?.filename || "");
      if (src.includes("threejs-components") || msg.includes("getSupportedExtensions") || msg.includes("WebGL") || msg.includes("WebGPU")) {
        e.preventDefault();
        fail("CDN library runtime error", msg);
      }
    };
    window.addEventListener("error", errorHandler);

    rejHandler = (e: PromiseRejectionEvent) => {
      const reason: any = e?.reason;
      const msg = String(reason?.message || reason || "");
      const stack = String(reason?.stack || "");
      if (stack.includes("threejs-components") || msg.includes("getSupportedExtensions") || msg.includes("WebGL") || msg.includes("WebGPU")) {
        e.preventDefault();
        fail("CDN library promise rejection", msg);
      }
    };
    window.addEventListener("unhandledrejection", rejHandler);

    (async () => {
      try {
        const mod: any = await import(/* @vite-ignore */ CDN_URL);
        if (cancelled || !canvas) return;

        const TubesCursor = mod.default || mod;
        if (typeof TubesCursor !== "function") {
          fail("CDN module did not export a function");
          return;
        }

        try {
          app = TubesCursor(canvas, {
            tubes: {
              colors: TUBE_COLORS,
              lights: {
                intensity: 300,
                colors: LIGHT_COLORS,
              },
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

        // Reveal canvas after the WebGL context is set up
        canvas.style.opacity = "1";

        // Click anywhere to randomize palette (matches SuperDesign behavior)
        onClick = () => {
          if (!app?.tubes) return;
          try {
            app.tubes.setColors(getRandomColors(3));
            app.tubes.setLightsColors(getRandomColors(4));
          } catch (err) {
            console.warn("[TubesCursor] randomize failed:", err);
          }
        };
        document.addEventListener("click", onClick);
      } catch (err) {
        fail("failed to load library", err);
      }
    })();

    return () => {
      cancelled = true;
      if (onClick) document.removeEventListener("click", onClick);
      if (errorHandler) window.removeEventListener("error", errorHandler);
      if (rejHandler) window.removeEventListener("unhandledrejection", rejHandler);
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
