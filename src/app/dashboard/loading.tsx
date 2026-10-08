// Tampil INSTAN saat pindah halaman (selagi data server dimuat), dan
// membuat prefetch halaman dinamis jadi efektif.
export default function DashboardLoading() {
  return (
    <div className="page-enter" aria-busy="true" aria-label="Memuat halaman">
      <div className="skeleton mb-6 h-8 w-48" />
      <div className="skeleton mb-5 h-32 w-full" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="skeleton h-28" />
        <div className="skeleton h-28" />
      </div>
      <div className="skeleton mt-5 h-48 w-full" />
    </div>
  );
}
