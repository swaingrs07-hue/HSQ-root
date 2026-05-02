import { useEffect, useRef } from "react";

interface TubesCursorBackgroundProps {
  className?: string;
  enabled?: boolean;
  reduceMotion?: boolean;
  /**
   * When true, ask the WebGL animation to pause its render loop without
   * tearing down the GPU context. Used to free GPU while a hero <video>
   * is playing so the video doesn't drop frames.
   */
  paused?: boolean;
  onFailure?: () => void;
  /**
   * Called once the WebGL canvas has been initialized and its first frame
   * has been requested (fires right after we set canvas opacity to 1).
   * Used by the homepage loading overlay to know when the 3D background
   * is ready so the loader can stop holding back the hero reveal.
   */
  onReady?: () => void;
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
  paused = false,
  onFailure,
  onReady,
}: TubesCursorBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Track the live app instance and the latest pause-request so the
  // visibility handler / a separate pause effect can both reach the
  // same controller without re-running the heavy init effect.
  const appRef = useRef<TubesApp | null>(null);
  const pauseRequestedRef = useRef(paused);

  // Whenever the caller toggles `paused`, apply it to the live app
  // (if one exists yet) and remember the latest desired state for any
  // app that finishes initializing later.
  useEffect(() => {
    pauseRequestedRef.current = paused;
    const app = appRef.current;
    const canvas = canvasRef.current;
    if (!app) return;
    const shouldPause =
      paused ||
      (typeof document !== "undefined" &&
        document.visibilityState === "hidden");
    if (shouldPause) {
      if (typeof app.pause === "function") app.pause();
      else if (canvas) canvas.style.visibility = "hidden";
    } else {
      if (typeof app.resume === "function") app.resume();
      else if (canvas) canvas.style.visibility = "visible";
    }
  }, [paused]);

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

        // Adaptive FPS gate — measure the page's baseline frame rate
        // BEFORE instantiating the heavy WebGL context. On Windows +
        // an integrated or older discrete GPU the iridescent shader
        // stacked with the rest of the page (CSS-3D perspective in
        // plans-hallway, particle canvas, framer-motion scroll
        // subscriptions) can't sustain 60fps and the user perceives
        // the whole site as laggy even on a decent gaming laptop.
        // Apple GPUs handle this load fine, so we don't disable
        // outright — we measure first and only bail when we KNOW the
        // device can't afford it. Hidden tabs (and headless test
        // environments) report 0 fps from RAF, so we skip the gate
        // when the tab isn't visible to avoid a false positive.
        if (document.visibilityState === "visible") {
          const fps = await new Promise<number>((resolve) => {
            const SAMPLE_MS = 900;
            let frames = 0;
            const t0 = performance.now();
            const tick = () => {
              if (cancelled) return resolve(60); // bail measurement on teardown
              frames++;
              const elapsed = performance.now() - t0;
              if (elapsed >= SAMPLE_MS) {
                resolve((frames / elapsed) * 1000);
              } else {
                requestAnimationFrame(tick);
              }
            };
            requestAnimationFrame(tick);
          });
          if (cancelled) return;
          // Threshold history (this gate has been re-tuned twice as
          // we learned more about which workloads actually contended
          // with the tubes on Windows):
          //   - 45 fps: original. Caught nothing useful — most pages
          //     measure 60+ at idle even on weak hardware.
          //   - 55 fps: raised after a Dell G15 5515 user reported
          //     sustained lag. But this disabled tubes on the SAME
          //     Dell where the user had previously seen and loved
          //     them, leaving them with a bland gradient fallback.
          //   - 30 fps: current. The user explicitly asked for the
          //     real tubes back. The right architectural answer is to
          //     let the tubes run on every machine that can actually
          //     render WebGL2 at a reasonable rate, and trust the
          //     other Windows-Chrome optimizations (hero video pauses
          //     off-screen, tubes pause WHILE the hero video plays,
          //     hallway video re-encoded + paused off-screen, hallway
          //     cards layer-isolated, hero video mask UA-gated) to
          //     keep the rest of the page smooth. Those mitigations
          //     mean the tubes never compete with another heavy GPU
          //     consumer at the same time, so the original "tubes
          //     stack with everything" justification for an
          //     aggressive gate is largely gone.
          //
          //     30 fps remains a hard floor — anything measuring
          //     below that at idle is genuinely broken (background
          //     tab throttling, battery saver, ancient hardware) and
          //     would visibly stutter even without tubes. For those
          //     devices the IridescentFallbackBackground takes over.
          const MIN_FPS = 30;
          if (fps < MIN_FPS) {
            console.log(
              `[TubesCursor] disabled — baseline ${fps.toFixed(1)} fps below ${MIN_FPS} threshold`,
            );
            fail(`baseline frame rate ${fps.toFixed(1)} fps too low`);
            return;
          }
          console.log(`[TubesCursor] baseline ${fps.toFixed(1)} fps — enabling`);
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
        appRef.current = app;

        canvas.style.opacity = "1";

        // Notify any listener (e.g. the homepage loading overlay) that the
        // 3D background is up. Defer one frame so the first iridescent
        // pixels actually land on screen before we say "ready".
        if (onReady) {
          requestAnimationFrame(() => {
            if (!cancelled) onReady();
          });
        }

        // If the caller asked to pause before init finished, honor it
        // — but defer by one animation frame so the WebGL renderer has
        // a chance to draw at least one full iridescent frame to the
        // canvas. Otherwise, callers that mask only a band of the
        // canvas (the home hero feathers its bottom 30% to transparent
        // so the tubes show through behind the CTAs) would see a
        // blank/dark band instead of the iridescent glow they expect,
        // because we'd have stopped the loop before any pixels were
        // ever drawn.
        if (pauseRequestedRef.current && typeof app.pause === "function") {
          requestAnimationFrame(() => {
            // Re-check the ref inside the RAF: the caller may have
            // released the pause request in the same tick (e.g. the
            // user scrolled past the hero before the first frame
            // rendered) — in that case there's nothing to do.
            if (pauseRequestedRef.current && app && typeof app.pause === "function") {
              app.pause();
            }
          });
        }

        // Pause/resume on tab visibility changes to save GPU/battery.
        // Also keeps the caller-requested pause state in mind so a
        // tab returning to visible doesn't accidentally resume the
        // tubes while a hero <video> is still playing.
        visibilityHandler = () => {
          if (!app) return;
          const hidden = document.visibilityState === "hidden";
          const shouldPause = hidden || pauseRequestedRef.current;
          if (shouldPause) {
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
      appRef.current = null;
    };
  }, [enabled, reduceMotion, onFailure, onReady]);

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
