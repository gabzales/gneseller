import type { Metadata, Viewport } from "next";
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
import "@fontsource/sora/800.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { THEME_STORAGE_KEY, THEMES, DEFAULT_THEME } from "@/lib/theme";

// Runs before paint, straight in <head>, so a saved theme is applied
// immediately -- no flash of the default palette on load/refresh.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var saved = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var themes = ${JSON.stringify(THEMES.map((t) => ({ id: t.id, vars: t.vars })))};
    var theme = themes.find(function (t) { return t.id === saved; })
      || themes.find(function (t) { return t.id === ${JSON.stringify(DEFAULT_THEME)}; });
    var root = document.documentElement;
    Object.keys(theme.vars).forEach(function (key) {
      root.style.setProperty(key, theme.vars[key]);
    });
  } catch (e) {}
})();
`;

export const metadata: Metadata = {
  title: "GHOSTNEWERA — Reseller Panel",
  description:
    "Panel reseller resmi GHOSTNEWERA. Generate key instan, top up saldo QRIS, dan pantau riwayat transaksi kapan saja.",
  icons: {
    icon: "/favicon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-body antialiased bg-bg text-ink min-h-dvh">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
