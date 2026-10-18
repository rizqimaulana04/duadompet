"use client";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Brand } from "./brand";
import { Button } from "./ui/button";
import { inviteCallback } from "@/lib/callback";
type Fields = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};
const subscribe = () => () => {};
export function AuthForm({ mode }: { mode: string }) {
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const { register, handleSubmit } = useForm<Fields>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const params = useSearchParams();
  const callback = inviteCallback(params.get("callbackUrl"));
  const callbackQuery = callback
    ? "?callbackUrl=" + encodeURIComponent(callback)
    : "";
  const title =
    mode === "register"
      ? "Mulai perjalanan finansialmu"
      : mode === "forgot-password"
        ? "Lupa kata sandi?"
        : mode === "reset-password"
          ? "Buat kata sandi baru"
          : "Selamat datang kembali";
  async function submit(data: Fields) {
    setBusy(true);
    setError("");
    try {
      if (mode === "login") {
        const r = await signIn("credentials", { ...data, redirect: false });
        if (!r || r.error || !r.ok)
          throw new Error("Email atau kata sandi salah. Silakan coba kembali.");
        const accountData = await fetch("/api/data", {
          cache: "no-store",
        }).then((r) => r.json());
        window.location.assign(
          callback ||
            (accountData.wallets?.length ? "/dashboard" : "/onboarding"),
        );
      } else {
        const r = await fetch("/api/account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...data,
            action:
              mode === "register"
                ? "register"
                : mode === "forgot-password"
                  ? "forgot"
                  : "reset",
            token: params.get("token"),
          }),
        });
        const result = await r.json();
        if (!r.ok) throw new Error(result.error);
        if (mode === "register")
          window.location.assign(
            "/login?registered=1" +
              (callback ? "&callbackUrl=" + encodeURIComponent(callback) : ""),
          );
        else setSent(true);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-shell">
      <aside className="auth-story">
        <Brand />
        <div>
          <span className="badge blue">DUA DOMPET, SATU TUJUAN.</span>
          <h1 style={{ marginTop: 25 }}>
            Langkah kecil hari ini.
            <br />
            Impian besar berdua.
          </h1>
          <p>
            Bangun kebiasaan keuangan yang lebih baik, sambil menjaga ruang
            pribadi masing-masing.
          </p>
        </div>
        <p>Catatan keuangan Anda. Kendali sepenuhnya di tangan Anda.</p>
      </aside>
      <main className="auth-form">
        <div>
          <Link href="/">
            <Brand />
          </Link>
          <h1>{title}</h1>
          <p className="muted">
            {mode === "register"
              ? "Gratis untuk memulai. Bersama untuk bertumbuh."
              : "Dua dompet, satu langkah lebih dekat ke tujuan."}
          </p>
          {sent ? (
            <div className="card" style={{ marginTop: 25 }}>
              <p>
                {mode === "forgot-password"
                  ? "Jika email terdaftar, tautan pemulihan akan dikirim."
                  : "Kata sandi berhasil diperbarui."}
              </p>
              <Link className="btn primary" href="/login">
                Kembali masuk
              </Link>
            </div>
          ) : (
            <form method="post" onSubmit={handleSubmit(submit)}>
              {mode === "register" && (
                <label>
                  Nama lengkap
                  <input autoComplete="name" required {...register("name")} />
                </label>
              )}
              {mode !== "reset-password" && (
                <label>
                  Email
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    {...register("email")}
                  />
                </label>
              )}
              {mode !== "forgot-password" && (
                <label>
                  Kata sandi
                  <input
                    type="password"
                    aria-label="Kata sandi"
                    aria-describedby={
                      mode === "login" ? undefined : "password-help"
                    }
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    minLength={mode === "login" ? 1 : 12}
                    maxLength={72}
                    required
                    {...register("password")}
                  />
                  {mode !== "login" && (
                    <span className="muted" id="password-help">
                      Minimal 12 karakter, huruf besar, kecil, dan angka.
                    </span>
                  )}
                </label>
              )}
              {mode === "register" && (
                <label>
                  Konfirmasi kata sandi
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    {...register("confirmPassword")}
                  />
                </label>
              )}
              {mode === "login" && (
                <p style={{ textAlign: "right", marginBottom: 20 }}>
                  <Link href="/forgot-password" className="small green">
                    Lupa kata sandi?
                  </Link>
                </p>
              )}
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <Button disabled={busy || !ready} type="submit">
                {busy
                  ? "Memproses…"
                  : mode === "login"
                    ? "Masuk ke DuaDompet"
                    : mode === "register"
                      ? "Buat akun gratis"
                      : "Kirim"}
              </Button>
            </form>
          )}
          <p className="muted small" style={{ textAlign: "center" }}>
            {mode === "login" ? (
              <>
                Belum punya akun?{" "}
                <Link href={"/register" + callbackQuery} className="green">
                  Daftar gratis
                </Link>
              </>
            ) : (
              <Link href={"/login" + callbackQuery}>
                Sudah punya akun? Masuk
              </Link>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
