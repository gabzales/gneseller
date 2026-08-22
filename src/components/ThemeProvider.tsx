"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  applyTheme,
  DEFAULT_THEME,
  getTheme,
  THEME_STORAGE_KEY,
  type ThemeId,
} from "@/lib/theme";

type ThemeContextValue = {
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME);

  // Sync with whatever the blocking inline script (see layout.tsx) already
  // applied pre-paint, so React state matches the DOM instead of causing a
  // flash back to the default on hydration.
  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
    if (saved) setThemeIdState(saved);
  }, []);

  const setThemeId = useCallback((id: ThemeId) => {
    const theme = getTheme(id);
    applyTheme(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme.id);
    setThemeIdState(theme.id);
  }, []);

  return (
    <ThemeContext.Provider value={{ themeId, setThemeId }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme() harus dipakai di dalam <ThemeProvider>");
  return ctx;
}
