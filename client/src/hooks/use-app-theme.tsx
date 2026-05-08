import { createContext, useContext, useEffect, useState } from "react";

type AppTheme = "dark" | "light";

interface AppThemeContextValue {
  theme: AppTheme;
  toggle: () => void;
}

const AppThemeContext = createContext<AppThemeContextValue>({
  theme: "dark",
  toggle: () => {},
});

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<AppTheme>(() => {
    try {
      return (localStorage.getItem("app-theme") as AppTheme) || "dark";
    } catch {
      return "dark";
    }
  });

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  useEffect(() => {
    try {
      localStorage.setItem("app-theme", theme);
    } catch {}
  }, [theme]);

  return (
    <AppThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(AppThemeContext);
}
