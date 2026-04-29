import { createContext, useContext } from "react";

export interface TubesContextValue {
  active: boolean;
  setPauseRequested?: (paused: boolean) => void;
}

export const TubesContext = createContext<TubesContextValue>({ active: false });

export function useTubesActive(): boolean {
  return useContext(TubesContext).active;
}
