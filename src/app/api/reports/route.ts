import { currentUser } from "@/lib/auth";
import { snapshot } from "@/lib/service";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
export const dynamic = "force-dynamic";
const csv = (s: string) =>
  '"' + (/^[=+\-@\t\r]/.test(s) ? "'" : "") + s.replaceAll('"', '""') + '"';
export async function GET(req: Request) {
  try {
    const user = await currentUser();
    const data = await snapshot(user.id);
    const p = new URL(req.url).searchParams;
    const shared = p.get("shared") === "true";
    const start = new Date(p.get("from") ?? "2000-01-01");
    const end = new Date(p.get("to") ?? "2100-01-01");
    if (isNaN(+start) || isNaN(+end))
      return new Response("Periode tidak valid", { status: 400 });
    const entries = data.entries.filter(
      (e) =>
        !!e.wallet.householdId === shared &&
        e.posting.date >= start &&
        e.posting.date < end &&
        (!p.get("wallet") || e.walletId === p.get("wallet")) &&
        (!p.get("category") || (e.category?.name ?? 'Lainnya') === p.get("category")) &&
        (!p.get("user") || e.creatorId === p.get("user")) &&
        `${e.posting.description} ${e.category?.name ?? ""}`
          .toLowerCase()
          .includes((p.get("search") ?? "").toLowerCase()),
    );
    const rows = [
      ["Tanggal", "Deskripsi", "Jenis", "Kategori", "Dompet", "Nominal IDR"],
      ...entries.map((e) => [
        e.posting.date.toISOString().slice(0, 10),
        e.posting.description,
        e.posting.kind,
        e.category?.name ?? "",
        e.wallet.name,
        e.amount.toString(),
      ]),
    ];
    const headers = {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="duadompet-laporan.${p.get("format") === "pdf" ? "pdf" : "csv"}"`,
    };
    if (p.get("format") !== "pdf")
      return new Response(
        "\uFEFF" + rows.map((row) => row.map(csv).join(",")).join("\r\n"),
        { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" } },
      );
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    let page = pdf.addPage([595, 842]);
    let y = 790;
    const text = (s: string, size = 10) => {
      if (y < 55) {
        page = pdf.addPage([595, 842]);
        y = 790;
      }
      page.drawText(s.replace(/[^\x20-\x7E]/g, "?").slice(0, 105), {
        x: 42,
        y,
        size,
        font: size > 12 ? bold : font,
        color: rgb(0.1, 0.17, 0.3),
      });
      y -= size + 9;
    };
    text("DuaDompet | Laporan keuangan", 21);
    text(`${user.name} | Ruang ${shared ? "bersama" : "pribadi"}`);
    text(
      `Periode ${start.toISOString().slice(0, 10)} - ${end.toISOString().slice(0, 10)}`,
    );
    text("Saldo merupakan catatan manual, bukan saldo bank terverifikasi.");
    y -= 12;
    const income = entries
      .filter((e) => e.posting.kind === "INCOME")
      .reduce((s, e) => s + e.amount, 0n);
    const expense = entries
      .filter((e) => e.posting.kind === "EXPENSE")
      .reduce((s, e) => s - e.amount, 0n);
    text(
      `Pemasukan Rp${income} | Pengeluaran Rp${expense} | Arus kas Rp${income - expense}`,
      12,
    );
    const categoryTotals = new Map<string, bigint>();
    for (const e of entries.filter((e) => e.posting.kind === "EXPENSE"))
      categoryTotals.set(
        e.category?.name ?? "Lainnya",
        (categoryTotals.get(e.category?.name ?? "Lainnya") ?? 0n) - e.amount,
      );
    text("Pengeluaran per kategori", 15);
    for (const [name, value] of categoryTotals) text(`${name}: Rp${value}`);
    const contribution = entries
      .filter((e) => e.posting.kind === "CONTRIBUTION" && e.amount > 0n)
      .reduce((sum, e) => sum + e.amount, 0n);
    text(`Kontribusi diterima (bukan pemasukan baru): Rp${contribution}`);
    text("Rincian transaksi", 15);
    for (const row of rows.slice(1))
      text(
        `${row[0]} | ${row[1].slice(0, 26)} | ${row[4].slice(0, 16)} | Rp${row[5]}`,
      );
    text("Saldo dompet (seluruh waktu)", 15);
    for (const w of data.wallets.filter((w) => !!w.householdId === shared))
      text(`${w.name}: Rp${w.balance}`);
    text("Tujuan dan anggaran", 15);
    for (const r of data.resources.filter(
      (r) => !!r.householdId === shared && r.kind !== "BILL",
    )) {
      const used =
        r.kind === "GOAL"
          ? r.events.reduce((s, e) => s + e.amount, 0n)
          : data.entries
              .filter(
                (e) =>
                  !!e.wallet.householdId === shared &&
                  e.posting.kind === "EXPENSE" &&
                  (e.category?.name ?? "Lainnya") === r.category &&
                  e.posting.date.toISOString().slice(0, 7) ===
                    r.date.toISOString().slice(0, 7),
              )
              .reduce((s, e) => s - e.amount, 0n);
      text(
        `${r.kind} ${r.name}: target Rp${r.amount}; ${r.kind === "GOAL" ? "alokasi" : "terpakai"} Rp${used}`,
      );
    }
    pdf.getPages().forEach((p, i) =>
      p.drawText(`DuaDompet | ${i + 1} / ${pdf.getPageCount()}`, {
        x: 42,
        y: 25,
        size: 8,
        font,
        color: rgb(0.45, 0.5, 0.6),
      }),
    );
    return new Response(Buffer.from(await pdf.save()), {
      headers: { ...headers, "Content-Type": "application/pdf" },
    });
  } catch {
    return new Response("Tidak dapat membuat laporan", {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
