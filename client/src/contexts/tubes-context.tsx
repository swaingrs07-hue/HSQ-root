import { createContext, useContext } from "react";

export interface TubesContextValue {
  active: boolean;
}

export const TubesContext = createContext<TubesContextValue>({ active: false });

export function useTubesActive(): boolean {
  return useContext(TubesContext).active;
}
