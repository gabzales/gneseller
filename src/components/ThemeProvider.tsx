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

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: ReactNode;
  // The signed-in account's saved theme (public.users.theme), passed down
  // by the dashboard layout via getCurrentUser(). Undefined on
  // logged-out pages (marketing/login), where localStorage is still the
  // only signal available.
  initialTheme?: ThemeId;
}) {
  const [themeId, setThemeIdState] = useState<ThemeId>(initialTheme ?? DEFAULT_THEME);

  // Account theme (server-rendered, always fresh) wins over whatever the
  // blocking pre-paint script guessed from localStorage -- that script
  // only exists to avoid a flash-of-default before this component
  // mounts, it doesn't know about the account at all (it runs before any
  // network request). Re-applies whenever the account's theme changes
  // (e.g. switched on another device, then this one reloads).
  useEffect(() => {
    if (!initialTheme) return;
    const theme = getTheme(initialTheme);
    applyTheme(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme.id);
    setThemeIdState(theme.id);
  }, [initialTheme]);

  // Logged-out fallback: sync with whatever the blocking inline script
  // (see layout.tsx) already applied pre-paint from localStorage, so
  // React state matches the DOM instead of causing a flash back to the
  // default on hydration. Skipped once an account theme is known --
  // the effect above already takes precedence.
  useEffect(() => {
    if (initialTheme) return;
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
    if (saved) setThemeIdState(saved);
  }, [initialTheme]);

  const setThemeId = useCallback((id: ThemeId) => {
    const theme = getTheme(id);
    applyTheme(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme.id);
    setThemeIdState(theme.id);

    // Persist to the account too, not just this device's localStorage,
    // so the choice follows the user across devices/browsers. Fire-and-
    // forget: the local UI has already updated above regardless of
    // whether this succeeds, and a logged-out visitor (initialTheme
    // undefined, no session) simply gets a 401 here which is fine to
    // ignore -- localStorage is still the correct behavior for them.
    fetch("/api/profile/theme", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ themeId: theme.id }),
    }).catch(() => {
      // Network hiccup -- theme still applied locally, just not synced
      // to the account this time. Not worth surfacing as an error for a
      // cosmetic preference.
    });
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
