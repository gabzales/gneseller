"use client";

import { Check, Palette } from "lucide-react";
import { THEMES } from "@/lib/theme";
import { useTheme } from "@/components/ThemeProvider";

export default function ThemeSwitcher() {
  const { themeId, setThemeId } = useTheme();

  return (
    <div className="mt-4 rounded-xl2 border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-dim text-primary">
          <Palette size={16} />
        </span>
        <div>
          <p className="text-[13.5px] font-bold">Tema Warna</p>
          <p className="text-[11.5px] text-ink-faint">
            Ganti tampilan dashboard sesuai selera
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {THEMES.map((theme) => {
          const active = theme.id === themeId;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => setThemeId(theme.id)}
              aria-pressed={active}
              className={`relative flex flex-col items-center gap-2 rounded-xl2 border p-3 transition-colors ${
                active
                  ? "border-primary bg-primary-dim"
                  : "border-border bg-surface-2 hover:border-border-strong"
              }`}
            >
              {active && (
                <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white">
                  <Check size={10} strokeWidth={3} />
                </span>
              )}
              <span className="flex -space-x-1.5">
                {theme.swatch.map((color, i) => (
                  <span
                    key={i}
                    className="h-6 w-6 rounded-full border-2 border-surface"
                    style={{ background: color }}
                  />
                ))}
              </span>
              <span className="text-[11px] font-semibold">{theme.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
