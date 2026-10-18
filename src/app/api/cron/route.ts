import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { percent } from "@/lib/finance";
import { nextBillDate } from "@/lib/bills";
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("Cron not configured", { status: 503 });
  const expected = Buffer.from("Bearer " + secret);
  const actual = Buffer.from(req.headers.get("authorization") ?? "");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    return new Response("Unauthorized", { status: 401 });
  const month = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
  await db.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  const resources = await db.resource.findMany({
    where: { kind: { in: ["BILL", "BUDGET"] } },
    include: { events: true },
  });
  let count = 0;
  for (const r of resources) {
    let title = "";
    if (r.kind === "BILL") {
      const next = nextBillDate(
        r.date.toISOString(),
        r.recurrence,
        r.events.map((e) => e.period),
      );
      if (
        next >= new Date(Date.now() - 86400000) &&
        next <= new Date(Date.now() + 7 * 86400000)
      )
        title = "Tagihan mendekati jatuh tempo: " + r.name;
    } else if (r.date.toISOString().slice(0, 7) === month) {
      const entries = await db.entry.findMany({
        where: {
          wallet: r.householdId
            ? { householdId: r.householdId }
            : { ownerId: r.ownerId, householdId: null },
          posting: {
            kind: "EXPENSE",
            date: {
              gte: new Date(month + "-01T00:00:00Z"),
              lt: new Date(
                Date.UTC(
                  Number(month.slice(0, 4)),
                  Number(month.slice(5, 7)),
                  1,
                ),
              ),
            },
          },
          OR: [
            { category: { name: r.category } },
            ...(r.category === "Lainnya" ? [{ categoryId: null }] : []),
          ],
        },
      });
      const sum = entries.reduce((s, e) => s - e.amount, 0n);
      if (percent(sum, r.amount) >= 80)
        title = "Anggaran mendekati atau melewati batas: " + r.name;
    }
    if (title) {
      const ids = r.householdId
        ? (
            await db.householdMember.findMany({
              where: { householdId: r.householdId },
            })
          ).map((m) => m.userId)
        : [r.ownerId];
      for (const id of ids) {
        const user = await db.user.findUnique({ where: { id } });
        if (user?.notificationsEnabled) {
          const dedupe = `${id}:${r.id}:${month}`;
          await db.notification.upsert({
            where: { dedupe },
            create: { userId: id, title, dedupe },
            update: {},
          });
          count++;
        }
      }
    }
  }
  return Response.json({ ok: true, processed: count });
}
