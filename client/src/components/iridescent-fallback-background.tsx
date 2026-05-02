import { memo } from "react";

/**
 * Lightweight CSS-only fallback for the WebGL `TubesCursorBackground`.
 *
 * Why this exists:
 *   The iridescent WebGL tubes layer is the single most expensive thing on
 *   the page. On mid-tier Windows GPUs (Dell G15 5515 et al.) the adaptive
 *   FPS gate in `tubes-cursor-background.tsx` correctly disables that layer
 *   to keep the rest of the page smooth — but the result was that the user
 *   was left staring at a flat #050505 background, which read as "missing
 *   feature" rather than "graceful degradation".
 *
 *   This component is the visual stand-in. Five soft radial-gradient
 *   "blobs" using the same palette as the WebGL tubes
 *   (#ff008a / #2e6cfe / #60aed5 / #fe8a2e / #83f36e), composited with
 *   `mix-blend-mode: screen` so they bloom into each other the way the
 *   tubes' lights do. Each blob slowly drifts on a unique long-period
 *   keyframe animation that animates ONLY `transform` (GPU-composited, no
 *   layout/paint), so the cost is "one extra compositor layer per blob"
 *   and nothing else.
 *
 * Performance budget:
 *   - 5 layers, each ≤ 75vw on the largest dimension
 *   - Animation: 28-35s ease-in-out, alternates direction
 *   - No filter:blur() — expensive on Windows. Soft edges come from the
 *     gradient stop position (color → transparent at 65%) instead.
 *   - No reflow, no repaint outside the layer's own box.
 *
 * The component itself is opacity-0 on mount and fades to 1 over ~1.4s so
 * it doesn't pop in abruptly when the FPS gate fires.
 */

const STYLE_BLOCK = `
  @keyframes iridescent-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes iridescent-drift-1 {
    0%, 100% { transform: translate3d(-8%, -10%, 0) scale(1);    }
    50%      { transform: translate3d(14%,  12%, 0) scale(1.18); }
  }
  @keyframes iridescent-drift-2 {
    0%, 100% { transform: translate3d( 12%,  6%, 0) scale(1.10); }
    50%      { transform: translate3d(-14%, -10%, 0) scale(0.92); }
  }
  @keyframes iridescent-drift-3 {
    0%, 100% { transform: translate3d(  6%, 14%, 0) scale(1);    }
    50%      { transform: translate3d(-16%,-14%, 0) scale(1.22); }
  }
  @keyframes iridescent-drift-4 {
    0%, 100% { transform: translate3d(-14%, 10%, 0) scale(1.08); }
    50%      { transform: translate3d( 12%,-16%, 0) scale(0.94); }
  }
  @keyframes iridescent-drift-5 {
    0%, 100% { transform: translate3d( 10%,-12%, 0) scale(1.05); }
    50%      { transform: translate3d(-10%, 12%, 0) scale(1.20); }
  }
  .iridescent-fallback-blob {
    position: absolute;
    border-radius: 50%;
    mix-blend-mode: screen;
    will-change: transform;
    pointer-events: none;
  }
`;

interface BlobSpec {
  color: string;
  size: string;
  pos: { top?: string; right?: string; bottom?: string; left?: string };
  animation: string;
  alpha: number;
}

const BLOBS: BlobSpec[] = [
  {
    color: "255,0,138",
    size: "70vmax",
    pos: { top: "-22%", left: "-18%" },
    animation: "iridescent-drift-1 28s ease-in-out infinite",
    alpha: 0.55,
  },
  {
    color: "46,108,254",
    size: "65vmax",
    pos: { top: "-12%", right: "-22%" },
    animation: "iridescent-drift-2 32s ease-in-out infinite",
    alpha: 0.55,
  },
  {
    color: "96,174,213",
    size: "75vmax",
    pos: { bottom: "-28%", left: "8%" },
    animation: "iridescent-drift-3 35s ease-in-out infinite",
    alpha: 0.5,
  },
  {
    color: "254,138,46",
    size: "55vmax",
    pos: { bottom: "-18%", right: "-12%" },
    animation: "iridescent-drift-4 30s ease-in-out infinite",
    alpha: 0.45,
  },
  {
    color: "131,243,110",
    size: "50vmax",
    pos: { top: "30%", left: "30%" },
    animation: "iridescent-drift-5 33s ease-in-out infinite",
    alpha: 0.35,
  },
];

interface IridescentFallbackBackgroundProps {
  className?: string;
}

function IridescentFallbackBackgroundImpl({
  className,
}: IridescentFallbackBackgroundProps) {
  return (
    <div
      className={className}
      data-testid="iridescent-fallback-background"
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        background: "#050505",
        animation: "iridescent-fade-in 1.4s ease-out both",
        contain: "strict",
        isolation: "isolate",
      }}
    >
      <style>{STYLE_BLOCK}</style>
      {BLOBS.map((b, i) => (
        <div
          key={i}
          className="iridescent-fallback-blob"
          style={{
            width: b.size,
            height: b.size,
            ...b.pos,
            background: `radial-gradient(circle at center, rgba(${b.color},${b.alpha}), rgba(${b.color},0) 65%)`,
            animation: b.animation,
          }}
        />
      ))}
    </div>
  );
}

export default memo(IridescentFallbackBackgroundImpl);
