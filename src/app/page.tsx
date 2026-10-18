import Link from "next/link";
import {
  ArrowRight,
  WalletCards,
  Users,
  Target,
  ShieldCheck,
  ChartNoAxesCombined,
  CalendarCheck,
  Check,
  Heart,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { CashChart } from "@/components/charts";
export default function Page() {
  return (
    <>
      <header className="landing-nav">
        <Link href="/">
          <Brand />
        </Link>
        <nav>
          <a href="#fitur">Fitur</a>
          <a href="#cara-kerja">Cara kerja</a>
          <a href="#faq">FAQ</a>
          <Link href="/login">Masuk</Link>
          <Link className="btn primary" href="/register">
            Mulai Gratis <ArrowRight size={15} />
          </Link>
        </nav>
      </header>
      <main>
        <section className="hero">
          <span className="badge blue">
            <Heart size={12} /> Keuangan lebih tenang, hubungan lebih nyaman
          </span>
          <h1>
            Kelola Keuangan Bersama,
            <br />
            <em>Wujudkan Impian Berdua.</em>
          </h1>
          <p>
            Satu tempat untuk dompet pribadi, kebutuhan keluarga, dan impian
            bersama. Mulai langkah finansial yang lebih terarah hari ini.
          </p>
          <div className="toolbar">
            <Link href="/register" className="btn primary">
              Mulai Gratis <ArrowRight size={16} />
            </Link>
            <Link href="/demo" className="btn outline">
              Lihat Demo
            </Link>
          </div>
          <p className="small">
            <Check size={13} style={{ display: "inline" }} /> Dompet pribadi
            tetap privat &nbsp; · &nbsp; Catatan manual, kendali penuh
          </p>
          <div className="preview">
            <div className="card-title">
              <div>
                <span className="eyebrow">PREVIEW PRODUK · DATA ILUSTRASI</span>
                <h2 style={{ marginTop: 8 }}>
                  Selangkah lebih dekat ke impian ✨
                </h2>
              </div>
              <span className="badge blue">Rumah tangga</span>
            </div>
            <div className="stats">
              {[
                ["Total saldo tercatat", "Rp18.750.000"],
                ["Pemasukan", "Rp11.000.000"],
                ["Pengeluaran", "Rp5.800.000"],
                ["Tabungan bulan ini", "Rp5.200.000"],
              ].map(([label, value]) => (
                <div className="card stat" key={label}>
                  <div className="stat-label">
                    {label}
                    <WalletCards size={17} />
                  </div>
                  <strong>{value}</strong>
                  <span className="small muted">Contoh tampilan dashboard</span>
                </div>
              ))}
            </div>
            <CashChart
              data={[
                { name: "Minggu 1", income: 3200000, expense: 1600000 },
                { name: "Minggu 2", income: 5500000, expense: 1200000 },
                { name: "Minggu 3", income: 1400000, expense: 1800000 },
                { name: "Minggu 4", income: 900000, expense: 1200000 },
              ]}
            />
          </div>
        </section>
        <section id="fitur" className="section">
          <span className="eyebrow">
            LEBIH RAPI. LEBIH TERBUKA. LEBIH DEKAT.
          </span>
          <h2 style={{ marginTop: 12 }}>
            Semua yang penting, dalam satu tempat.
          </h2>
          <p className="muted">
            Dirancang untuk hidup Anda hari ini dan rencana Anda esok hari.
          </p>
          <div className="features">
            {[
              [
                WalletCards,
                "Dompet sesuai kebutuhan",
                "Pisahkan uang pribadi dan bersama. Pantau saldo yang Anda catat dengan lebih mudah.",
              ],
              [
                Users,
                "Kolaborasi dengan pasangan",
                "Undang pasangan melalui tautan aman dan kelola kebutuhan rumah tangga bersama.",
              ],
              [
                Target,
                "Impian jadi lebih dekat",
                "Alokasikan tabungan untuk dana darurat, rumah pertama, atau perjalanan berdua.",
              ],
              [
                ChartNoAxesCombined,
                "Pahami alur uang Anda",
                "Lihat pemasukan, pengeluaran, dan kategori belanja dalam laporan yang mudah dipahami.",
              ],
              [
                CalendarCheck,
                "Anggaran & tagihan",
                "Tetapkan batas bulanan dan catat pembayaran tagihan setelah Anda mengonfirmasinya.",
              ],
              [
                ShieldCheck,
                "Ruang pribadi tetap terjaga",
                "Anggota rumah tangga hanya dapat melihat dompet yang dibagikan.",
              ],
            ].map(([Icon, title, text]) => {
              const I = Icon as typeof WalletCards;
              return (
                <article className="card feature" key={String(title)}>
                  <span className="feature-icon">
                    <I size={24} />
                  </span>
                  <h2>{String(title)}</h2>
                  <p>{String(text)}</p>
                </article>
              );
            })}
          </div>
        </section>
        <section className="section" id="cara-kerja">
          <h2>Dari obrolan kecil, jadi rencana bersama.</h2>
          <div className="features">
            {[
              [
                "01",
                "Buat ruang keuanganmu",
                "Daftar, buat dompet pertama, dan masukkan saldo awal opsional.",
              ],
              [
                "02",
                "Catat & ajak pasangan",
                "Kelola sendiri atau undang pasangan untuk berbagi satu rumah tangga.",
              ],
              [
                "03",
                "Wujudkan tujuan kalian",
                "Susun anggaran, alokasikan tabungan, dan pantau perkembangan bersama.",
              ],
            ].map(([n, t, d]) => (
              <div className="card feature" key={n}>
                <span className="feature-icon">{n}</span>
                <h2>{t}</h2>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="section">
          <div className="two-col">
            <article className="card">
              <span className="feature-icon">
                <WalletCards />
              </span>
              <h2>Dompetmu, ruang pribadimu.</h2>
              <p className="muted" style={{ marginTop: 12 }}>
                Dompet pribadi hanya dapat dilihat pemiliknya. Bergabung dalam
                rumah tangga tidak membuka catatan pribadi Anda kepada pasangan.
              </p>
            </article>
            <article className="card">
              <span className="feature-icon">
                <Heart />
              </span>
              <h2>Tujuan kalian, langkah bersama.</h2>
              <p className="muted" style={{ marginTop: 12 }}>
                Mulai dari dana pernikahan, DP rumah, hingga pendidikan anak.
                Catat alokasi tabungan nyata dan lihat progresnya.
              </p>
            </article>
          </div>
        </section>
        <section className="section faq" id="faq">
          <h2>Pertanyaan yang sering ditanyakan</h2>
          {[
            [
              "Apakah DuaDompet terhubung ke bank?",
              "Tidak. DuaDompet adalah aplikasi pencatatan manual. Saldo merupakan catatan Anda dan bukan saldo bank yang telah diverifikasi.",
            ],
            [
              "Haruskah saya mengundang pasangan?",
              "Tidak. Anda dapat menggunakan mode pribadi dan membuat rumah tangga kapan saja.",
            ],
            [
              "Apakah pasangan bisa melihat semua transaksi saya?",
              "Hanya transaksi pada dompet bersama. Dompet pribadi tetap hanya dapat diakses oleh pemilik.",
            ],
            [
              "Apakah data saya dikirim ke AI?",
              "Tidak. Insight menggunakan aturan lokal pada data Anda; tidak membutuhkan layanan AI eksternal.",
            ],
            [
              "Apakah bisa dipakai tanpa internet?",
              "Aplikasi menyediakan pemberitahuan offline. Pencatatan keuangan memerlukan koneksi; sinkronisasi transaksi offline tidak tersedia.",
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </section>
        <section className="section">
          <div className="banner">
            <div>
              <h2 style={{ fontSize: 30 }}>Dua dompet. Satu tujuan.</h2>
              <p>Mulai kebiasaan baik untuk masa depan yang kalian inginkan.</p>
            </div>
            <Link
              href="/register"
              className="btn outline"
              style={{ color: "#2563eb" }}
            >
              Mulai Gratis <ArrowRight size={17} />
            </Link>
          </div>
        </section>
      </main>
      <footer>
        <Brand />
        <span className="small">
          © {new Date().getFullYear()} DuaDompet · Catat dengan sadar,
          rencanakan bersama.
        </span>
      </footer>
    </>
  );
}
