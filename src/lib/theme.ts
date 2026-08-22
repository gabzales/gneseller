/**
 * Theme palettes for GhostSeller.
 *
 * Each palette overrides the same CSS variable set defined in
 * globals.css. Selection is stored client-side (localStorage) per
 * device -- no DB migration needed. ThemeProvider applies the saved
 * palette to `document.documentElement` before paint.
 */

export type ThemeId =
  | "monokrom"
  | "ghost"
  | "mint"
  | "sunset"
  | "ocean"
  | "grape";

export type ThemeVars = {
  "--bg": string;
  "--surface": string;
  "--surface-2": string;
  "--border": string;
  "--border-strong": string;
  "--ink": string;
  "--ink-dim": string;
  "--ink-faint": string;
  "--primary": string;
  "--primary-dim": string;
  "--rose": string;
  "--rose-dim": string;
  "--teal": string;
  "--teal-dim": string;
  "--amber": string;
  "--amber-dim": string;
  "--danger": string;
  "--danger-dim": string;
};

export type Theme = {
  id: ThemeId;
  name: string;
  /** Swatch dots shown on the picker card, light -> dark or a nice spread. */
  swatch: string[];
  vars: ThemeVars;
};

const shared = {
  "--danger": "#b91c1c",
  "--danger-dim": "#fef2f2",
} as const;

export const THEMES: Theme[] = [
  {
    id: "monokrom",
    name: "Monokrom",
    swatch: ["#0a0a0a", "#525252", "#e5e5e5"],
    vars: {
      "--bg": "#ffffff",
      "--surface": "#ffffff",
      "--surface-2": "#f5f5f5",
      "--border": "#e5e5e5",
      "--border-strong": "#d4d4d4",
      "--ink": "#0a0a0a",
      "--ink-dim": "#525252",
      "--ink-faint": "#a3a3a3",
      "--primary": "#0a0a0a",
      "--primary-dim": "#f0f0f0",
      "--rose": "#171717",
      "--rose-dim": "#f0f0f0",
      "--teal": "#171717",
      "--teal-dim": "#f0f0f0",
      "--amber": "#171717",
      "--amber-dim": "#f0f0f0",
      ...shared,
    },
  },
  {
    id: "ghost",
    name: "Ghost Purple",
    swatch: ["#6d5ef8", "#f4436c", "#2dd4bf"],
    vars: {
      "--bg": "#f5f4ff",
      "--surface": "#ffffff",
      "--surface-2": "#efedff",
      "--border": "#e3e0fb",
      "--border-strong": "#cbc5f7",
      "--ink": "#171426",
      "--ink-dim": "#5b5578",
      "--ink-faint": "#a39bc9",
      "--primary": "#6d5ef8",
      "--primary-dim": "#eae7fe",
      "--rose": "#f4436c",
      "--rose-dim": "#feeaee",
      "--teal": "#0fb8a6",
      "--teal-dim": "#e2faf5",
      "--amber": "#f5a524",
      "--amber-dim": "#fef3e0",
      ...shared,
    },
  },
  {
    id: "mint",
    name: "Mint Fresh",
    swatch: ["#12b886", "#0ea5e9", "#f59e0b"],
    vars: {
      "--bg": "#f2fbf7",
      "--surface": "#ffffff",
      "--surface-2": "#e7f8f0",
      "--border": "#d7f0e4",
      "--border-strong": "#b9e6d1",
      "--ink": "#0e2a20",
      "--ink-dim": "#4c6d5e",
      "--ink-faint": "#93b3a4",
      "--primary": "#12b886",
      "--primary-dim": "#e1f7ee",
      "--rose": "#0ea5e9",
      "--rose-dim": "#e4f4fd",
      "--teal": "#0d9488",
      "--teal-dim": "#dcf6f1",
      "--amber": "#f59e0b",
      "--amber-dim": "#fef3e0",
      ...shared,
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    swatch: ["#fb7185", "#fb923c", "#a855f7"],
    vars: {
      "--bg": "#fff7f5",
      "--surface": "#ffffff",
      "--surface-2": "#fff0ec",
      "--border": "#fbe1da",
      "--border-strong": "#f7c9bc",
      "--ink": "#2c1810",
      "--ink-dim": "#7a5a4b",
      "--ink-faint": "#c9a999",
      "--primary": "#fb7185",
      "--primary-dim": "#feeaee",
      "--rose": "#fb923c",
      "--rose-dim": "#fef0e2",
      "--teal": "#a855f7",
      "--teal-dim": "#f6ecfe",
      "--amber": "#f59e0b",
      "--amber-dim": "#fef3e0",
      ...shared,
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    swatch: ["#0284c7", "#06b6d4", "#f59e0b"],
    vars: {
      "--bg": "#f2f9fd",
      "--surface": "#ffffff",
      "--surface-2": "#e7f3fb",
      "--border": "#d7ebf6",
      "--border-strong": "#b9deef",
      "--ink": "#0b2536",
      "--ink-dim": "#496b7d",
      "--ink-faint": "#93b0bf",
      "--primary": "#0284c7",
      "--primary-dim": "#e1f0fb",
      "--rose": "#e11d48",
      "--rose-dim": "#fde5e9",
      "--teal": "#06b6d4",
      "--teal-dim": "#dcf5fa",
      "--amber": "#f59e0b",
      "--amber-dim": "#fef3e0",
      ...shared,
    },
  },
  {
    id: "grape",
    name: "Grape",
    swatch: ["#9333ea", "#ec4899", "#22c55e"],
    vars: {
      "--bg": "#faf5fe",
      "--surface": "#ffffff",
      "--surface-2": "#f4e9fc",
      "--border": "#ecd9f8",
      "--border-strong": "#dcb9f2",
      "--ink": "#28123a",
      "--ink-dim": "#6b4c7e",
      "--ink-faint": "#af95bd",
      "--primary": "#9333ea",
      "--primary-dim": "#f2e5fd",
      "--rose": "#ec4899",
      "--rose-dim": "#fce7f2",
      "--teal": "#22c55e",
      "--teal-dim": "#e4f9ea",
      "--amber": "#f59e0b",
      "--amber-dim": "#fef3e0",
      ...shared,
    },
  },
];

export const DEFAULT_THEME: ThemeId = "monokrom";
export const THEME_STORAGE_KEY = "gs-theme";

export function getTheme(id: string | null | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME)!;
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.vars)) {
    root.style.setProperty(key, value);
  }
}
