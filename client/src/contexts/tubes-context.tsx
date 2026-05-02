import { createContext, useContext } from "react";

export interface TubesContextValue {
  active: boolean;
  /**
   * True once the WebGL background has actually rendered its first frame
   * (or has been declared not-applicable, e.g. reduced-motion / no WebGL).
   * Consumers like the homepage loading overlay use this to know when the
   * 3D background is ready to be seen.
   */
  ready: boolean;
  setPauseRequested?: (paused: boolean) => void;
  /**
   * Per-page scroll-tied opacity (0-1) for the global tubes layer. Default
   * is full brightness (1.0). Currently used by the homepage card-swipe
   * (Task #147) to keep the iridescent tubes hidden while the hero is in
   * view, then fade them in once the next section has covered the hero.
   *
   * Implementation note: the layout writes the value to a CSS custom
   * property on `documentElement` (`--tubes-reveal-opacity`) and the
   * tubes / veil layers consume it via `opacity: var(...)`. This avoids
   * triggering a React re-render on every scroll frame.
   */
  setRevealOpacity?: (opacity: number) => void;
}

export const TubesContext = createContext<TubesContextValue>({
  active: false,
  ready: true,
});

export function useTubesActive(): boolean {
  return useContext(TubesContext).active;
}

export function useTubesReady(): boolean {
  return useContext(TubesContext).ready;
}
