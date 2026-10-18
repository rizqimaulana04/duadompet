import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("landing, demo and responsive layout", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Kelola Keuangan Bersama/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Lihat Demo" }).click();
  await expect(page.getByText("MODE DEMO", { exact: false })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Halo, Nadia/ }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  if (page.viewportSize()!.width > 850) {
    await page.getByRole('button', { name: 'Ringkas sidebar' }).click();
    await expect(page.getByRole('button', { name: 'Buka sidebar' })).toHaveAttribute('aria-expanded','false');
    await expect(page.locator('#desktop-sidebar').getByRole('link',{name:'Pengaturan',exact:true})).toBeVisible();
    await page.getByRole('button', { name: 'Buka sidebar' }).click();
  }
  const manifest = await page.request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  expect((await manifest.json()).icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192", type: "image/png" }),
      expect.objectContaining({ sizes: "512x512", type: "image/png" }),
    ]),
  );
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    return true;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  expect(await page.evaluate(() => caches.keys())).toEqual([]);
  await page.context().setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Anda sedang offline." }),
  ).toBeVisible();
  await page.context().setOffline(false);
});
test("two adults complete personal and shared financial workflows", async ({
  page,
  browser,
}) => {
  test.skip(
    !process.env.E2E_DATABASE,
    "Requires migrated disposable PostgreSQL",
  );
  test.setTimeout(300000);
  const id = Date.now();
  const email = `e2e-a-${id}@example.invalid`;
  const partnerEmail = `e2e-b-${id}@example.invalid`;
  async function register(p: Page, email: string, name: string, callback = "") {
    await p.goto(
      "/register" +
        (callback ? "?callbackUrl=" + encodeURIComponent(callback) : ""),
    );
    await p.getByLabel("Nama lengkap").fill(name);
    await p.getByLabel("Email", { exact: true }).fill(email);
    await p
      .getByLabel("Kata sandi", { exact: true })
      .fill("StrongPassword123!");
    await p.getByLabel("Konfirmasi kata sandi").fill("StrongPassword123!");
    await p.getByRole("button", { name: "Buat akun gratis" }).click();
    await expect(p).toHaveURL(/login/);
    await p.getByLabel("Email", { exact: true }).fill(email);
    await p
      .getByLabel("Kata sandi", { exact: true })
      .fill("StrongPassword123!");
    await p.getByRole("button", { name: "Masuk ke DuaDompet" }).click();
    await expect(p).toHaveURL(
      callback ? /household\/invitations/ : /onboarding/,
    );
  }
  async function save(p: Page) {
    await p.getByRole("button", { name: "Simpan", exact: true }).click();
    await expect(p.getByRole("dialog")).toHaveCount(0);
  }
  await register(page, email, "Pengguna Uji");
  await page.getByRole("button", { name: "Buat dompet pertama" }).click();
  await page.getByLabel("Nama dompet").fill("Rekening pribadi A");
  await save(page);
  await page.getByRole("link", { name: "Lanjut ke dashboard" }).click();
  await page.getByRole("button", { name: "Tambah Transaksi" }).click();
  await page.getByLabel("Jenis transaksi").selectOption("INCOME");
  await page.getByLabel("Deskripsi").fill("Gaji pengujian");
  await page.getByLabel("Nominal (Rp)", { exact: true }).fill("1000000");
  await save(page);
  await expect(page.getByText("Gaji pengujian", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Tambah Transaksi" }).click();
  await page.getByLabel("Deskripsi").fill("Makan pengujian");
  await page.getByLabel("Nominal (Rp)", { exact: true }).fill("100000");
  await save(page);
  await expect(
    page.getByText("Makan pengujian", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".stat").first()).toContainText("900.000");
  await page.goto("/household");
  await page
    .getByRole("button", { name: "Buat rumah tangga", exact: true })
    .click();
  await page.getByLabel("Nama rumah tangga").fill("Rumah Uji");
  await save(page);
  await page
    .getByRole("button", { name: "Undang pasangan", exact: true })
    .click();
  await page.getByLabel("Email pasangan").fill(partnerEmail);
  await save(page);
  const invite = await page.locator("input[readonly]").inputValue();
  const second = await browser.newContext({ baseURL: "http://127.0.0.1:3000" });
  const partner = await second.newPage();
  await partner.goto(invite);
  await expect(partner).toHaveURL(/login\?callbackUrl=/);
  const callback = new URL(partner.url()).searchParams.get("callbackUrl") ?? "";
  await register(partner, partnerEmail, "Pasangan Uji", callback);
  await partner.goto(invite);
  await partner
    .getByRole("button", { name: "Terima undangan", exact: true })
    .click();
  await expect(
    partner.getByRole("heading", { name: "Rumah Uji", exact: true }),
  ).toBeVisible();
  await page.goto("/wallets");
  await page.getByRole("button", { name: "Bersama", exact: true }).click();
  await page.getByRole("button", { name: "Tambah Dompet" }).click();
  await page.getByLabel("Nama dompet").fill("Rekening bersama");
  await save(page);
  await page.goto("/transactions");
  await page.getByRole("button", { name: "Bersama", exact: true }).click();
  await page.getByRole("button", { name: "Tambah Transaksi" }).click();
  await page.getByLabel("Deskripsi").fill("Belanja bersama");
  await page.getByLabel("Nominal (Rp)", { exact: true }).fill("50000");
  await page
    .getByLabel("Dompet sumber")
    .selectOption({ label: "Rekening bersama (Bersama)" });
  await save(page);
  await expect(
    page.getByText("Belanja bersama", { exact: true }),
  ).toBeVisible();
  await partner.goto("/transactions");
  await partner.getByRole("button", { name: "Bersama", exact: true }).click();
  await partner.getByLabel('Filter kategori').selectOption('Lainnya');
  await expect(
    partner.getByText("Belanja bersama", { exact: true }),
  ).toBeVisible();
  await expect(
    partner.getByText("Gaji pengujian", { exact: true }),
  ).toHaveCount(0);
  await page.goto("/goals");
  await page.getByRole("button", { name: "Tambah Tujuan" }).click();
  await page.getByLabel("Nama", { exact: true }).fill("Dana rumah");
  await page.getByLabel("Nominal target (Rp)").fill("10000000");
  await save(page);
  await expect(
    page.getByRole("heading", { name: "Dana rumah", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Catat alokasi / penarikan" }).click();
  await page.getByLabel("Nominal (Rp)", { exact: true }).fill("100000");
  await save(page);
  await expect(page.getByText("1%", { exact: true })).toBeVisible();
  await page.goto("/budgets");
  await page.getByRole("button", { name: "Tambah Anggaran" }).click();
  await page.getByLabel("Nama", { exact: true }).fill("Anggaran makan");
  await page.getByLabel("Nominal target (Rp)").fill("2000000");
  await save(page);
  await expect(
    page.getByRole("heading", { name: "Anggaran makan" }),
  ).toBeVisible();
  await page.goto("/reports");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Unduh CSV" }).click();
  expect((await download).suggestedFilename()).toBe("duadompet-laporan.csv");
  const pdfDownload = page.waitForEvent("download");
  await page.getByRole("link", { name: "Unduh PDF" }).click();
  const pdf = await pdfDownload;
  expect(pdf.suggestedFilename()).toBe("duadompet-laporan.pdf");
  const pdfPath = await pdf.path();
  expect(pdfPath).toBeTruthy();
  expect((await readFile(pdfPath!)).subarray(0, 4).toString()).toBe("%PDF");
  await page.goto("/settings");
  await page
    .getByRole('main')
    .getByRole("button", { name: "Keluar", exact: true })
    .click();
  await expect(page).toHaveURL("http://127.0.0.1:3000/");
  await second.close();
});
