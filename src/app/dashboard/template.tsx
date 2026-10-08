// template.tsx di-mount ulang setiap pindah halaman, jadi animasi masuk
// ini jalan di tiap navigasi (layout/sidebar tetap diam, hanya konten).
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
