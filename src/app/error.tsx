"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="auth-form" style={{ minHeight: "100vh" }}>
      <div>
        <h1>Terjadi gangguan</h1>
        <p className="muted">
          Periksa koneksi dan konfigurasi database, lalu coba kembali.
        </p>
        <button className="btn primary" onClick={reset}>
          Coba kembali
        </button>
      </div>
    </main>
  );
}
