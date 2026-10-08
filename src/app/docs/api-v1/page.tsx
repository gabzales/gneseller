import type { Metadata } from "next";

// Halaman publik (tanpa login) -- middleware.ts cuma menjaga /dashboard/**,
// jadi URL ini bisa langsung dikirim ke toko client.
export const metadata: Metadata = {
  title: "Partner API v1 — Dokumentasi",
  description: "Dokumentasi REST API untuk toko client: lihat katalog & harga, generate key otomatis.",
};

const BASE = `${(process.env.APP_URL || "https://ghostseller.my.id").replace(/\/+$/, "")}/api/v1/partner`;

function Code({ children, label }: { children: string; label?: string }) {
  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border bg-[#0d1117]">
      {label && <div className="border-b border-white/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{label}</div>}
      <pre className="overflow-x-auto p-4 text-[12.5px] leading-relaxed text-zinc-200">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-3 mt-12 scroll-mt-20 text-xl font-extrabold tracking-tight">
      {children}
    </h2>
  );
}

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "get" | "post" | "neutral" }) {
  const cls =
    tone === "get" ? "bg-emerald-500/15 text-emerald-500" : tone === "post" ? "bg-sky-500/15 text-sky-500" : "bg-surface-2 text-ink-faint";
  return <span className={`rounded-md px-2 py-0.5 font-mono text-[11.5px] font-bold ${cls}`}>{children}</span>;
}

const ERRORS: Array<[string, string, string, string]> = [
  ["401", "unauthorized", "Header X-API-Key tidak dikirim, salah, atau key sudah dinonaktifkan/dihapus.", "Cek key. Minta admin GhostSeller cek statusnya."],
  ["400", "missing_fields", "productId / durationId kosong atau bukan string.", "Perbaiki body request."],
  ["400", "invalid_product_or_duration", "Produk atau durasi tidak ada.", "Ambil ulang katalog lewat GET /products."],
  ["402", "insufficient_balance", "Saldo akun reseller yang terikat ke key ini tidak cukup.", "Minta admin top up saldo akun partner. Jangan retry berulang."],
  ["404", "user_not_found", "Akun reseller yang terikat ke key tidak ditemukan.", "Hubungi admin GhostSeller."],
  ["409", "out_of_stock", "Stok paket ini habis.", "Tampilkan 'stok habis' ke pembeli; jangan potong saldo pembeli."],
  ["429", "rate_limited", "Lebih dari 60 request/menit untuk key ini.", "Tunggu lalu coba lagi (backoff)."],
  ["502", "provider_error", "Supplier upstream gagal/menolak. Pesan di field message sudah aman ditampilkan.", "Coba lagi nanti; kalau terus terjadi hubungi admin."],
  ["500", "partner_reseller_not_configured", "Key belum terikat ke akun reseller.", "Hubungi admin GhostSeller."],
];

export default function PartnerApiDocsPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-10 text-ink">
      <p className="text-[12px] font-bold uppercase tracking-widest text-primary">Partner API · v1</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Dokumentasi REST API GhostSeller</h1>
      <p className="mt-3 text-[14.5px] leading-relaxed text-ink-dim">
        API server-to-server untuk toko client: ambil katalog + harga akun kamu, lalu generate key otomatis setiap ada pembelian di toko kamu.
        Semua request lewat HTTPS dengan payload JSON.
      </p>

      <nav className="mt-6 flex flex-wrap gap-2 text-[12.5px] font-semibold">
        {[
          ["#ikhtisar", "Ikhtisar"],
          ["#auth", "Autentikasi"],
          ["#products", "GET /products"],
          ["#generate-key", "POST /generate-key"],
          ["#errors", "Kode error"],
          ["#alur", "Alur integrasi"],
          ["#contoh", "Contoh kode"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="rounded-full border border-border bg-surface px-3 py-1.5 hover:bg-surface-2">
            {label}
          </a>
        ))}
      </nav>

      <H2 id="ikhtisar">Ikhtisar</H2>
      <p className="text-[14px] leading-relaxed text-ink-dim">Base URL:</p>
      <Code>{BASE}</Code>
      <ul className="list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-ink-dim">
        <li>
          <b className="text-ink">Satu toko = satu API key.</b> Admin bisa membuat banyak key (masing-masing untuk toko client berbeda), menonaktifkan, regenerate, atau menghapus
          tanpa mengganggu key lain.
        </li>
        <li>
          <b className="text-ink">Tiap key terikat ke satu akun reseller</b> di GhostSeller. Saldo yang dipotong dan harga tier/custom yang berlaku mengikuti akun itu — bukan
          dari body request, jadi tidak bisa &quot;pura-pura&quot; jadi akun lain.
        </li>
        <li>Endpoint tidak memakai cookie/session — cukup header <code className="font-mono">X-API-Key</code>.</li>
      </ul>

      <H2 id="auth">Autentikasi</H2>
      <p className="text-[14px] leading-relaxed text-ink-dim">
        Kirim API key di header <code className="font-mono">X-API-Key</code> pada setiap request. Key diberikan oleh admin GhostSeller (format{" "}
        <code className="font-mono">gs_partner_…</code>) dan hanya ditampilkan sekali saat dibuat.
      </p>
      <Code label="Header">{`X-API-Key: gs_partner_xxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json`}</Code>
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-[13px] leading-relaxed text-ink-dim">
        <b className="text-ink">Penting:</b> simpan key hanya di server (environment variable). Jangan taruh di frontend, aplikasi mobile, atau repository publik. Kalau bocor, minta
        admin regenerate/hapus key itu — key lama langsung mati.
      </div>

      <H2 id="products">
        <Pill tone="get">GET</Pill> <span className="font-mono text-[17px]">/products</span>
      </H2>
      <p className="text-[14px] leading-relaxed text-ink-dim">
        Daftar produk aktif beserta durasinya. Field <code className="font-mono">price</code> adalah <b className="text-ink">harga efektif untuk akun kamu</b> (sudah termasuk tier/harga
        custom); <code className="font-mono">base_price</code> adalah harga katalog standar. Gunakan endpoint ini saat setup dan untuk menyegarkan harga secara berkala — jangan dipanggil
        setiap ada pengunjung membuka halaman toko; simpan hasilnya di database/cache kamu.
      </p>
      <Code label="Request">{`curl ${BASE}/products \\
  -H "X-API-Key: gs_partner_xxx"`}</Code>
      <Code label="Response 200">{`{
  "data": [
    {
      "id": "drip-client",
      "name": "DRIP CLIENT APKMOD",
      "category": "General",
      "active": true,
      "product_durations": [
        {
          "id": "drip-1d",
          "label": "DRIP CLIENT FF 1 DAYS",
          "days": 1,
          "price": 4500,
          "base_price": 7250
        }
      ]
    }
  ]
}`}</Code>

      <H2 id="generate-key">
        <Pill tone="post">POST</Pill> <span className="font-mono text-[17px]">/generate-key</span>
      </H2>
      <p className="text-[14px] leading-relaxed text-ink-dim">
        Generate satu key untuk satu produk + durasi. <b className="text-ink">Saldo akun reseller yang terikat ke key dipotong sebesar harga efektif</b> saat request sukses. Key yang sudah
        terbit tidak bisa dibatalkan.
      </p>
      <div className="my-3 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-surface-2 text-ink-faint">
            <tr>
              <th className="px-3 py-2">Field</th>
              <th className="px-3 py-2">Tipe</th>
              <th className="px-3 py-2">Wajib</th>
              <th className="px-3 py-2">Keterangan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-ink-dim">
            <tr><td className="px-3 py-2 font-mono">productId</td><td className="px-3 py-2">string</td><td className="px-3 py-2">Ya</td><td className="px-3 py-2"><code className="font-mono">id</code> produk dari GET /products.</td></tr>
            <tr><td className="px-3 py-2 font-mono">durationId</td><td className="px-3 py-2">string</td><td className="px-3 py-2">Ya</td><td className="px-3 py-2"><code className="font-mono">id</code> durasi dari <code className="font-mono">product_durations</code>.</td></tr>
            <tr><td className="px-3 py-2 font-mono">idempotencyKey</td><td className="px-3 py-2">string</td><td className="px-3 py-2">Disarankan</td><td className="px-3 py-2">ID unik per pesanan di toko kamu (mis. nomor invoice). Kalau kosong, server membuat kunci otomatis per menit sehingga dua order produk+durasi yang sama dalam menit yang sama bisa dianggap satu.</td></tr>
          </tbody>
        </table>
      </div>
      <Code label="Request">{`curl -X POST ${BASE}/generate-key \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: gs_partner_xxx" \\
  -d '{
    "productId": "drip-client",
    "durationId": "drip-1d",
    "idempotencyKey": "INV-20260929-001"
  }'`}</Code>
      <Code label="Response 200">{`{
  "key": {
    "id": "8f1c…",
    "product_id": "drip-client",
    "product_name": "DRIP CLIENT APKMOD",
    "duration_label": "DRIP CLIENT FF 1 DAYS",
    "price": 4500,
    "key_string": "XXXX-XXXX-XXXX-XXXX",
    "created_at": "2026-09-29T03:00:00.000Z"
  }
}`}</Code>
      <p className="text-[14px] leading-relaxed text-ink-dim">
        Serahkan <code className="font-mono">key.key_string</code> ke pembeli. Belum ada endpoint cek-order: kalau request timeout atau koneksi putus, cek dulu riwayat key akun partner di
        dashboard (minta admin) sebelum mengulang, supaya tidak terbit dua key untuk satu pesanan.
      </p>

      <H2 id="errors">Kode error</H2>
      <p className="text-[14px] text-ink-dim">Semua error berbentuk <code className="font-mono">{`{ "error": "kode", "message": "…" }`}</code>.</p>
      <div className="my-3 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-[12.5px]">
          <thead className="bg-surface-2 text-ink-faint">
            <tr>
              <th className="px-3 py-2">HTTP</th>
              <th className="px-3 py-2">error</th>
              <th className="px-3 py-2">Arti</th>
              <th className="px-3 py-2">Tindakan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border align-top text-ink-dim">
            {ERRORS.map(([status, code, meaning, action]) => (
              <tr key={code}>
                <td className="px-3 py-2 font-mono font-bold">{status}</td>
                <td className="px-3 py-2 font-mono">{code}</td>
                <td className="px-3 py-2">{meaning}</td>
                <td className="px-3 py-2">{action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[13px] text-ink-faint">
        Rate limit: <b>60 request per menit per API key</b> pada <code className="font-mono">/generate-key</code>. Balasan 429 = berhenti sebentar dan coba lagi, jangan di-loop cepat.
      </p>

      <H2 id="alur">Alur integrasi yang disarankan</H2>
      <ol className="list-decimal space-y-1.5 pl-5 text-[14px] leading-relaxed text-ink-dim">
        <li>Panggil <code className="font-mono">GET /products</code> saat setup, simpan <code className="font-mono">id</code> produk &amp; durasi ke database toko kamu (mapping ke varian di toko).</li>
        <li>Segarkan harga secara berkala (mis. tiap beberapa jam), bukan tiap pengunjung.</li>
        <li>Saat pembayaran pembeli terkonfirmasi, panggil <code className="font-mono">POST /generate-key</code> dengan <code className="font-mono">idempotencyKey</code> = nomor pesanan kamu.</li>
        <li>Sukses → simpan &amp; kirim <code className="font-mono">key.key_string</code>. <code className="font-mono">402</code>/<code className="font-mono">409</code>/<code className="font-mono">502</code> → tampilkan pesan yang sesuai ke pembeli dan jangan tandai pesanan selesai.</li>
      </ol>

      <H2 id="contoh">Contoh kode</H2>
      <Code label="Node.js 18+">{`const BASE = "${BASE}";
const API_KEY = process.env.GHOSTSELLER_API_KEY; // simpan di env, jangan hardcode

async function generateKey(productId, durationId, orderNo) {
  const res = await fetch(\`\${BASE}/generate-key\`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
    body: JSON.stringify({ productId, durationId, idempotencyKey: orderNo }),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message || data.error), { code: data.error, status: res.status });
  return data.key.key_string;
}`}</Code>
      <Code label="Python 3">{`import os, requests

BASE = "${BASE}"
HEADERS = {"X-API-Key": os.environ["GHOSTSELLER_API_KEY"]}

def generate_key(product_id, duration_id, order_no):
    r = requests.post(f"{BASE}/generate-key", headers=HEADERS, timeout=35,
                      json={"productId": product_id, "durationId": duration_id,
                            "idempotencyKey": order_no})
    data = r.json()
    if not r.ok:
        raise RuntimeError(f"{data.get('error')}: {data.get('message')}")
    return data["key"]["key_string"]`}</Code>
      <p className="mt-2 text-[12.5px] text-ink-faint">Timeout klien disarankan ≥ 35 detik: pembuatan key bisa menunggu supplier upstream.</p>
    </main>
  );
}
