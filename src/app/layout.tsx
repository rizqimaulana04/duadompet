import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";
export const metadata: Metadata = {
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
  title: {
    default: "DuaDompet — Dua Dompet, Satu Tujuan.",
    template: "%s | DuaDompet",
  },
  description:
    "Kelola keuangan pribadi dan keluarga. Dompet, anggaran, dan impian bersama dalam satu tempat.",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "DuaDompet",
    description: "Dua Dompet, Satu Tujuan.",
    locale: "id_ID",
    type: "website",
  },
};
export const viewport: Viewport = { themeColor: "#2563eb" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
