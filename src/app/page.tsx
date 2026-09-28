import {
  PlayCircle,
  Bot,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import HowToBecomeReseller from "@/components/HowToBecomeReseller";
import LandingNav from "@/components/LandingNav";

const FEATURES = [
  {
    icon: Bot,
    tone: "primary" as const,
    title: "Bot Telegram Terintegrasi",
    body: "Reseller bisa jualan langsung dari Telegram tanpa buka panel — key terkirim otomatis ke pembeli.",
  },
  {
    icon: QrCode,
    tone: "teal" as const,
    title: "Payment Gateway QRIS",
    body: "Top up saldo real-time lewat QRIS. Saldo masuk otomatis begitu pembayaran terverifikasi.",
  },
  {
    icon: ShieldCheck,
    tone: "rose" as const,
    title: "Validasi Manual Opsional",
    body: "Butuh kontrol ekstra? Aktifkan validasi manual admin sebelum key benar-benar terkirim.",
  },
];

const TONE_BG = {
  primary: "bg-primary-dim text-primary",
  teal: "bg-teal-dim text-teal",
  rose: "bg-rose-dim text-rose",
};

export default function LandingPage() {
  return (
    <div className="min-h-dvh overflow-x-hidden">
      <LandingNav />

      <section className="relative bg-ghost-glow bg-no-repeat">
        <div className="mx-auto flex max-w-[720px] flex-col items-center gap-10 px-5 pb-16 pt-14 text-center sm:px-8 lg:pb-24 lg:pt-24">
          <div>
            <h1 className="mx-auto max-w-[420px] font-display text-[32px] font-extrabold leading-[1.15] sm:text-[38px] lg:text-[46px]">
              Raih Penghasilan Sebagai{" "}
              <span className="text-primary">Reseller Baru</span>
            </h1>
            <p className="mx-auto mt-5 max-w-[420px] text-[14px] leading-relaxed text-ink-dim lg:mx-0">
              Bergabung bersama kami dan dapatkan untung jutaan rupiah dalam
              sebulan — gratis bot Telegram untuk berjualan, terintegrasi
              payment gateway, dan opsi validasi manual.
            </p>
            <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              {/* Disabled on purpose: registration goes through admin via
                  WhatsApp (see #jadi-reseller below), there's no open
                  self-signup flow for this to link to. */}
              <button
                type="button"
                disabled
                aria-disabled="true"
                title="Pendaftaran lewat admin, lihat langkah di bawah"
                className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-ink px-6 py-3.5 text-[13.5px] font-bold text-bg opacity-40 sm:w-auto"
              >
                Coba Gratis
              </button>
              <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-border-strong px-6 py-3.5 text-[13.5px] font-bold text-ink-dim transition-colors hover:text-ink sm:w-auto">
                <PlayCircle size={16} /> Lihat Demo
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-surface-2/60">
        <div className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8">
          <h2 className="text-center font-display text-[22px] font-bold sm:text-[26px]">
            Semua yang reseller butuh, dalam satu panel
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl2 border border-border bg-surface p-6"
              >
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${TONE_BG[f.tone]}`}
                >
                  <f.icon size={19} />
                </span>
                <h3 className="mt-4 font-display text-[14.5px] font-bold">
                  {f.title}
                </h3>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-dim">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <HowToBecomeReseller />

      <footer className="border-t border-border">
        <div className="mx-auto max-w-[1180px] px-5 py-8 text-center text-[11.5px] text-ink-faint sm:px-8">
          © {new Date().getFullYear()} GHOSTNEWERA. Semua hak dilindungi.
        </div>
      </footer>
    </div>
  );
}
