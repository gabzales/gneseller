import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import LoginForm from "@/components/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; banned?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ghost-glow bg-no-repeat px-5 py-10">
      <div className="w-full max-w-[380px]">
        <Link
          href="/"
          className="mb-8 flex items-center gap-2 text-[12.5px] font-medium text-ink-faint transition-colors hover:text-ink-dim"
        >
          <ArrowLeft size={14} /> Kembali ke beranda
        </Link>

        <div className="rounded-xl2 border border-border-strong bg-surface p-8 text-center shadow-glow">
          <Image src="/logo-96.png" alt="GHOSTNEWERA" width={56} height={56} className="mx-auto h-14 w-14 rounded-2xl" />
          <h1 className="mt-5 font-display text-[19px] font-bold">
            Masuk ke GHOSTNEWERA
          </h1>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-faint">
            Akun reseller dibuatkan admin setelah pendaftaran lewat WhatsApp —
            masuk pakai email dan password yang diberikan.
          </p>

          <div className="mt-7">
            <LoginForm next={params.next ?? "/dashboard"} />
          </div>

          {params.error && (
            <p className="mt-4 text-[12px] font-medium text-danger">
              Login gagal, silakan coba lagi.
            </p>
          )}
          {params.banned && (
            <p className="mt-4 text-[12px] font-medium text-danger">
              Akun ini sudah dinonaktifkan admin. Hubungi admin kalau ini keliru.
            </p>
          )}

          <p className="mt-5 text-[10.5px] leading-relaxed text-ink-faint">
            Dengan masuk, kamu menyetujui Syarat Layanan dan Kebijakan
            Privasi GHOSTNEWERA.
          </p>
        </div>
      </div>
    </div>
  );
}
