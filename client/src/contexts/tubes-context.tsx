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
