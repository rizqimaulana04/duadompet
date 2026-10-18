import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export const token = () => randomBytes(32).toString("hex");
export async function limit(key: string, max = 8) {
  const now = new Date();
  const result = await db.$queryRaw<
    { hits: number }[]
  >`INSERT INTO "RateLimit" (key,hits,"expiresAt") VALUES (${digest(key)},1,${new Date(Date.now() + 900000)}) ON CONFLICT (key) DO UPDATE SET hits=CASE WHEN "RateLimit"."expiresAt" < ${now} THEN 1 ELSE "RateLimit".hits+1 END, "expiresAt"=CASE WHEN "RateLimit"."expiresAt" < ${now} THEN ${new Date(Date.now() + 900000)} ELSE "RateLimit"."expiresAt" END RETURNING hits`;
  if (result[0].hits > max)
    throw new Error("Terlalu banyak percobaan. Coba lagi dalam 15 menit.");
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin || origin !== new URL(process.env.NEXTAUTH_URL ?? req.url).origin)
    throw new Error("Permintaan tidak diizinkan");
}
export function walletScope(userId: string, householdId?: string) {
  return {
    OR: [
      { ownerId: userId, householdId: null },
      ...(householdId ? [{ householdId }] : []),
    ],
  };
}
