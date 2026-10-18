import { z } from "zod";
import { hash, compare } from "bcryptjs";
import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { digest, limit, sameOrigin, token } from "@/lib/security";
import { expenseCategories, incomeCategories } from "@/lib/finance";
import { json } from "@/lib/http";
import { passwordSchema as password } from '@/lib/validation';
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    await limit(
      "account-ip:" +
        (req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local"),
      30,
    );
    const raw = await req.json();
    const action = raw.action;
    if (action === "register") {
      const p = z
        .object({
          name: z.string().min(2).max(80),
          email: z.email().transform((s) => s.toLowerCase()),
          password,
          confirmPassword: z.string(),
        })
        .refine((p) => p.password === p.confirmPassword, {
          message: "Konfirmasi kata sandi tidak sesuai",
        })
        .parse(raw);
      await limit("register:" + p.email, 4);
      const encoded = await hash(p.password, 12);
      await db.user.create({
        data: {
          name: p.name,
          email: p.email,
          password: encoded,
          categories: {
            create: [
              ...incomeCategories.map((name) => ({ name, kind: "INCOME" })),
              ...expenseCategories.map((name) => ({ name, kind: "EXPENSE" })),
            ],
          },
        },
      });
      return json({ ok: true });
    }
    if (action === "forgot") {
      const email = z.email().parse(raw.email).toLowerCase();
      await limit("reset:" + email, 4);
      const user = await db.user.findUnique({ where: { email } });
      if (user) {
        const plain = token();
        await db.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash: digest(plain),
            expiresAt: new Date(Date.now() + 1800000),
          },
        });
        const link = `${process.env.NEXTAUTH_URL}/reset-password?token=${plain}`;
        if (process.env.SMTP_URL)
          await nodemailer.createTransport(process.env.SMTP_URL).sendMail({
            from: process.env.MAIL_FROM,
            to: email,
            subject: "Atur ulang kata sandi DuaDompet",
            text: `Tautan ini berlaku 30 menit: ${link}`,
          });
        else if (process.env.NODE_ENV !== "production")
          console.info("LOCAL ONLY password reset:", link);
      }
      return json({
        ok: true,
        message: "Jika email terdaftar, tautan pemulihan akan dikirim.",
      });
    }
    if (action === "reset") {
      const p = z.object({ token: z.string().length(64), password }).parse(raw);
      await limit("reset-token:" + digest(p.token));
      const encoded = await hash(p.password, 12);
      await db.$transaction(async (tx) => {
        const t = await tx.passwordResetToken.findUnique({
          where: { tokenHash: digest(p.token) },
        });
        if (!t || t.expiresAt < new Date())
          throw new Error("Tautan tidak valid atau kedaluwarsa");
        await tx.passwordResetToken.delete({ where: { id: t.id } });
        await tx.user.update({
          where: { id: t.userId },
          data: { password: encoded, sessionVersion: { increment: 1 } },
        });
        await tx.passwordResetToken.deleteMany({ where: { userId: t.userId } });
      });
      return json({ ok: true });
    }
    const user = await currentUser();
    if (action === "profile") {
      const name = z.string().min(2).max(80).parse(raw.name);
      await db.user.update({ where: { id: user.id }, data: { name } });
      return json({ ok: true });
    }
    if (action === "password") {
      await limit("change:" + user.id);
      const next = password.parse(raw.password);
      if (!(await compare(String(raw.currentPassword), user.password)))
        throw new Error("Kata sandi saat ini salah");
      await db.user.update({
        where: { id: user.id },
        data: {
          password: await hash(next, 12),
          sessionVersion: { increment: 1 },
        },
      });
      return json({ ok: true });
    }
    return json({ error: "Tindakan tidak valid" }, 400);
  } catch {
    return json(
      {
        error:
          "Permintaan gagal. Periksa isian, gunakan kata sandi 12 karakter dengan huruf besar, kecil, dan angka. Email mungkin sudah digunakan.",
      },
      400,
    );
  }
}
