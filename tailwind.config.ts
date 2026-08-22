import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        ink: "var(--ink)",
        "ink-dim": "var(--ink-dim)",
        "ink-faint": "var(--ink-faint)",
        primary: "var(--primary)",
        "primary-dim": "var(--primary-dim)",
        rose: "var(--rose)",
        "rose-dim": "var(--rose-dim)",
        teal: "var(--teal)",
        "teal-dim": "var(--teal-dim)",
        amber: "var(--amber)",
        "amber-dim": "var(--amber-dim)",
        danger: "var(--danger)",
        "danger-dim": "var(--danger-dim)",
      },
      fontFamily: {
        display: ["Sora", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      boxShadow: {
        glow: "0 1px 2px rgba(20,20,50,.04), 0 14px 28px -12px rgba(30,26,80,.14)",
        card: "0 1px 2px rgba(20,20,50,.03), 0 8px 20px -10px rgba(30,26,80,.10)",
      },
      backgroundImage: {
        "ghost-glow":
          "radial-gradient(60% 50% at 50% 0%, var(--primary-dim) 0%, transparent 70%)",
      },
      keyframes: {
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        float: "float 5s ease-in-out infinite",
        fadeUp: "fadeUp .4s ease-out both",
      },
    },
  },
  plugins: [],
};
export default config;
