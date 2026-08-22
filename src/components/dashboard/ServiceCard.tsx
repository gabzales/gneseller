import Link from "next/link";
import { LucideIcon, ArrowUpRight } from "lucide-react";

// Each tone maps straight to the active theme's CSS var (see src/lib/theme.ts
// + ThemeProvider), so switching theme recolors these cards -- not just the
// page background. 4 distinct tones = 4 distinct card colors, same idea as
// the reference layout (purple / red / green / peach cards).
const TONE_VARS = {
  primary: "var(--primary)",
  rose: "var(--rose)",
  teal: "var(--teal)",
  amber: "var(--amber)",
} as const;

export default function ServiceCard({
  href,
  title,
  subtitle,
  icon: Icon,
  tone,
}: {
  href: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tone: keyof typeof TONE_VARS;
}) {
  return (
    <Link
      href={href}
      style={{ backgroundColor: TONE_VARS[tone] }}
      className="group relative flex min-h-[130px] flex-col justify-between overflow-hidden rounded-xl2 p-5 text-white shadow-card transition-transform hover:-translate-y-0.5"
    >
      {/* subtle diagonal depth on top of the flat theme color, not a second color */}
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/0 via-white/0 to-black/20" />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-5 -top-5 h-16 w-16 rounded-full bg-white/15 transition-transform group-hover:scale-110"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-white/10"
      />
      <div className="relative flex items-start justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
          <Icon size={19} strokeWidth={2.1} />
        </span>
        <ArrowUpRight
          size={16}
          className="opacity-0 transition-opacity group-hover:opacity-90"
        />
      </div>
      <div className="relative">
        <p className="font-display text-[15px] font-bold leading-tight">{title}</p>
        <p className="mt-0.5 text-[11.5px] text-white/80">{subtitle}</p>
      </div>
    </Link>
  );
}
