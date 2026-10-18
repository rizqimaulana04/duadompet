import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { ledgerToday } from './dates';
import { amount, expenseCategories, incomeCategories } from "./finance";
import { RuleBasedInsights } from "./insights";
import { digest, token, walletScope } from "./security";
type Tx = Prisma.TransactionClient;
export async function context(userId: string) {
  return db.householdMember.findUnique({
    where: { userId },
    include: {
      household: {
        include: {
          plan: true,
          members: {
            orderBy: { role: "desc" },
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
  });
}
export async function scope(userId: string) {
  const member = await context(userId);
  return walletScope(userId, member?.householdId);
}
export async function snapshot(userId: string) {
  const member = await context(userId);
  const where = walletScope(userId, member?.householdId);
  const [wallets, entries, categories, resources, notifications, invitations] =
    await db.$transaction(
      [
        db.wallet.findMany({
          where,
          include: { entries: { select: { amount: true } } },
          orderBy: { name: "asc" },
        }),
        db.entry.findMany({
          where: { wallet: where },
          include: {
            posting: true,
            category: true,
            wallet: { select: { name: true, householdId: true } },
            creator: { select: { name: true } },
          },
          orderBy: { posting: { date: "desc" } },
        }),
        db.category.findMany({ where, orderBy: { name: "asc" } }),
        db.resource.findMany({ where, include: { events: true } }),
        db.notification.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
        db.householdInvitation.findMany({
          where:
            member?.role === "OWNER"
              ? { householdId: member.householdId }
              : { id: { in: [] } },
          select: { id: true, email: true, status: true, expiresAt: true },
        }),
      ],
      { isolationLevel: "RepeatableRead" },
    );
  const currentMonth = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
  const start = new Date(currentMonth + "-01T00:00:00Z");
  const end = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1),
  );
  const previous = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1),
  );
  async function scopedInsights(shared: boolean) {
    const list = entries.filter((e) => !!e.wallet.householdId === shared);
    const current = list.filter(
      (e) => e.posting.date >= start && e.posting.date < end,
    );
    return new RuleBasedInsights().analyze({
      income: current
        .filter((e) => e.posting.kind === "INCOME")
        .reduce((s, e) => s + e.amount, 0n),
      expenses: current
        .filter((e) => e.posting.kind === "EXPENSE")
        .reduce((s, e) => s - e.amount, 0n),
      previousExpenses: list
        .filter(
          (e) =>
            e.posting.date >= previous &&
            e.posting.date < start &&
            e.posting.kind === "EXPENSE",
        )
        .reduce((s, e) => s - e.amount, 0n),
      budgets: resources
        .filter(
          (r) =>
            !!r.householdId === shared &&
            r.kind === "BUDGET" &&
            r.date.toISOString().slice(0, 7) === currentMonth,
        )
        .map((r) => ({
          name: r.name,
          limit: r.amount,
          used: current
            .filter(
              (e) =>
                e.posting.kind === "EXPENSE" &&
                (e.category?.name ?? "Lainnya") === r.category,
            )
            .reduce((s, e) => s - e.amount, 0n),
        })),
    });
  }
  const insights = {
    personal: await scopedInsights(false),
    shared: await scopedInsights(true),
  };
  // No opposite wallet information is included in a shared transfer response.
  return {
    member,
    invitations,
    insights,
    wallets: wallets.map((w) => ({
      ...w,
      balance: w.entries.reduce((a, e) => a + e.amount, w.openingBalance),
      entries: undefined,
    })),
    entries,
    categories,
    resources,
    notifications,
  };
}
const postingInput = z.object({
  requestKey: z.string().uuid(),
  kind: z.enum(["INCOME", "EXPENSE", "TRANSFER", "CONTRIBUTION", "ADJUSTMENT"]),
  walletId: z.string(),
  destinationId: z.string().optional(),
  amount: z.string(),
  categoryId: z.string().optional(),
  description: z.string().min(1).max(180),
  notes: z.string().max(2000).default(""),
  date: z.iso.date(),
  id: z.string().optional(),
});
async function notify(tx: Tx, userId: string, title: string, dedupe: string) {
  const u = await tx.user.findUnique({ where: { id: userId } });
  if (u?.notificationsEnabled)
    await tx.notification.upsert({
      where: { dedupe },
      create: { userId, title, dedupe },
      update: {},
    });
}
export async function post(userId: string, raw: unknown) {
  const p = postingInput.parse(raw);
  const value = amount(p.amount);
  const where = await scope(userId);
  return db.$transaction(
    async (tx) => {
      const receipt = await tx.mutationReceipt.findUnique({
        where: { key: p.requestKey },
      });
      if (receipt) {
        if (receipt.userId !== userId)
          throw new Error("Permintaan tidak valid");
        return { id: receipt.postingId };
      }
      const old = await tx.posting.findUnique({
        where: { requestKey: p.requestKey },
      });
      if (old) {
        if (old.creatorId !== userId) throw new Error("Permintaan tidak valid");
        return old;
      }
      const source = await tx.wallet.findFirst({
        where: { id: p.walletId, ...where, archived: false },
      });
      if (!source) throw new Error("Dompet tidak ditemukan");
      const transfer = ["TRANSFER", "CONTRIBUTION"].includes(p.kind);
      if (transfer && !p.destinationId) throw new Error('Pilih dompet tujuan');
      const destination = transfer
        ? await tx.wallet.findFirst({
            where: { id: p.destinationId, ...where, archived: false },
          })
        : null;
      if (transfer && (!destination || destination.id === source.id))
        throw new Error("Pilih dua dompet berbeda yang dapat Anda akses");
      if (
        p.kind === "CONTRIBUTION" &&
        (!destination?.householdId || source.householdId)
      )
        throw new Error(
          "Kontribusi harus dari dompet pribadi ke dompet bersama",
        );
      const category = p.categoryId
        ? await tx.category.findFirst({ where: { id: p.categoryId, ...where } })
        : null;
      if (p.categoryId && !category)
        throw new Error("Kategori tidak ditemukan");
      if (
        category &&
        (category.householdId !== source.householdId ||
          (!source.householdId && category.ownerId !== userId))
      )
        throw new Error("Kategori tidak sesuai lingkup dompet");
      if (
        category &&
        ["INCOME", "EXPENSE"].includes(p.kind) &&
        category.kind !== p.kind
      )
        throw new Error("Jenis kategori tidak sesuai");
      if (p.id) {
        const prior = await tx.posting.findUnique({
          where: { id: p.id },
          include: { entries: true },
        });
        if (!prior || prior.deleted || prior.creatorId !== userId)
          throw new Error("Transaksi tidak dapat diubah");
        if (
          await tx.resourceEvent.findUnique({
            where: { requestKey: prior.requestKey },
          })
        )
          throw new Error(
            "Pembayaran tagihan tidak dapat diubah melalui transaksi",
          );
        const ids = prior.entries.map((x) => x.walletId);
        if (
          (await tx.wallet.count({ where: { id: { in: ids }, ...where } })) !==
          ids.length
        )
          throw new Error("Akses ditolak");
        await tx.entry.deleteMany({ where: { postingId: p.id } });
      }
      const recordData = {
        creatorId: userId,
        kind: p.kind,
        description: p.description,
        notes: p.notes,
        date: new Date(p.date + "T05:00:00Z"),
        entries: {
          create: [
            {
              walletId: source.id,
              creatorId: userId,
              categoryId: category?.id,
              amount: transfer || p.kind === "EXPENSE" ? -value : value,
            },
            ...(destination
              ? [{ walletId: destination.id, creatorId: userId, amount: value }]
              : []),
          ],
        },
      };
      const record = p.id
        ? await tx.posting.update({ where: { id: p.id }, data: recordData })
        : await tx.posting.create({
            data: { ...recordData, requestKey: p.requestKey },
          });
      await tx.mutationReceipt.create({
        data: { key: p.requestKey, userId, postingId: record.id },
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: p.id ? "POSTING_EDIT" : "POSTING_CREATE",
          targetId: record.id,
        },
      });
      const shared = source.householdId ?? destination?.householdId;
      if (shared) {
        const members = await tx.householdMember.findMany({
          where: { householdId: shared, userId: { not: userId } },
        });
        for (const m of members)
          await notify(
            tx,
            m.userId,
            "Aktivitas baru pada dompet bersama",
            "posting:" + record.id + ":" + m.userId,
          );
      }
      return record;
    },
    { isolationLevel: "Serializable" },
  );
}
export async function mutate(
  userId: string,
  action: string,
  raw: Record<string, unknown>,
) {
  const where = await scope(userId);
  const member = await context(userId);
  const shared = raw.shared === true;
  if (shared && !member) throw new Error("Buat rumah tangga terlebih dahulu");
  const ownership = {
    ownerId: userId,
    householdId: shared ? member!.householdId : null,
  };
  if (action === "wallet") {
    const p = z
      .object({
        name: z.string().min(1).max(80),
        type: z.enum(["CASH", "BANK", "EWALLET", "SAVINGS"]),
        openingBalance: z.string().regex(/^\d{1,15}$/),
      })
      .parse(raw);
    return db.wallet.create({
      data: { ...p, ...ownership, openingBalance: BigInt(p.openingBalance) },
    });
  }
  if (action === "walletUpdate") {
    const p = z
      .object({
        id: z.string(),
        name: z.string().min(1).max(80),
        archived: z.boolean(),
      })
      .parse(raw);
    const result = await db.wallet.updateMany({
      where: { id: p.id, ...where },
      data: { name: p.name, archived: p.archived },
    });
    if (!result.count) throw new Error("Dompet tidak ditemukan");
    return result;
  }
  if (action === "category") {
    const p = z
      .object({
        name: z.string().min(1).max(80),
        kind: z.enum(["INCOME", "EXPENSE"]),
      })
      .parse(raw);
    return db.category.create({ data: { ...p, ...ownership } });
  }
  if (action === "posting") return post(userId, raw);
  if (action === "deletePosting")
    return db.$transaction(
      async (tx) => {
        const p = await tx.posting.findUnique({
          where: { id: String(raw.id) },
          include: { entries: true },
        });
        if (!p || p.creatorId !== userId)
          throw new Error("Transaksi tidak ditemukan");
        if (
          await tx.resourceEvent.findUnique({
            where: { requestKey: p.requestKey },
          })
        )
          throw new Error(
            "Pembayaran tagihan tidak dapat dihapus melalui transaksi",
          );
        if (
          (await tx.wallet.count({
            where: { id: { in: p.entries.map((e) => e.walletId) }, ...where },
          })) !== p.entries.length
        )
          throw new Error("Akses ditolak");
        await tx.auditLog.create({
          data: { userId, action: "POSTING_DELETE", targetId: p.id },
        });
        await tx.entry.deleteMany({ where: { postingId: p.id } });
        return tx.posting.update({
          where: { id: p.id },
          data: { deleted: true },
        });
      },
      { isolationLevel: "Serializable" },
    );
  if (action === "household")
    return db.$transaction(async (tx) => {
      const p = z.object({ name: z.string().min(1).max(80) }).parse(raw);
      const h = await tx.household.create({
        data: { name: p.name, members: { create: { userId, role: "OWNER" } } },
      });
      await tx.category.createMany({
        data: [
          ...incomeCategories.map((name) => ({ name, kind: "INCOME" })),
          ...expenseCategories.map((name) => ({ name, kind: "EXPENSE" })),
        ].map((c) => ({ ...c, ownerId: userId, householdId: h.id })),
      });
      return h;
    });
  if (action === "invite") {
    if (member?.role !== "OWNER")
      throw new Error("Hanya pemilik dapat mengundang");
    const email = z.email().parse(raw.email).toLowerCase();
    if (
      email ===
      member.household.members.find((m) => m.userId === userId)?.user.email
    )
      throw new Error("Gunakan email pasangan");
    const plain = token();
    await db.householdInvitation.create({
      data: {
        householdId: member.householdId,
        email,
        tokenHash: digest(plain),
        expiresAt: new Date(Date.now() + 86400000 * 3),
      },
    });
    const invited = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (invited)
      await db.$transaction((tx) =>
        notify(
          tx,
          invited.id,
          "Anda menerima undangan pasangan. Mintalah tautan aman dari pengundang.",
          "invited:" + digest(plain),
        ),
      );
    return {
      link: `${process.env.NEXTAUTH_URL}/household/invitations?token=${plain}`,
    };
  }
  if (action === "accept" || action === "reject")
    return db.$transaction(
      async (tx) => {
        const invitation = await tx.householdInvitation.findUnique({
          where: { tokenHash: digest(String(raw.token)) },
        });
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
        if (
          !invitation ||
          invitation.email !== user.email ||
          invitation.status !== "PENDING" ||
          invitation.expiresAt < new Date()
        )
          throw new Error("Undangan tidak valid atau kedaluwarsa");
        if (action === "accept") {
          if (
            (await tx.householdMember.count({
              where: { householdId: invitation.householdId },
            })) >= 2
          )
            throw new Error("Rumah tangga sudah memiliki dua anggota");
          await tx.householdMember.create({
            data: { userId, householdId: invitation.householdId },
          });
          const owner = await tx.householdMember.findFirst({
            where: { householdId: invitation.householdId, role: "OWNER" },
          });
          if (owner)
            await notify(
              tx,
              owner.userId,
              "Pasangan menerima undangan",
              "invite:" + invitation.id,
            );
        }
        return tx.householdInvitation.update({
          where: { id: invitation.id },
          data: { status: action === "accept" ? "ACCEPTED" : "REJECTED" },
        });
      },
      { isolationLevel: "Serializable" },
    );
  if (action === "revoke") {
    if (member?.role !== "OWNER") throw new Error("Akses ditolak");
    return db.householdInvitation.updateMany({
      where: {
        id: String(raw.id),
        householdId: member.householdId,
        status: "PENDING",
      },
      data: { status: "REVOKED" },
    });
  }
  if (action === "resource") {
    const p = z
      .object({
        kind: z.enum(["BUDGET", "GOAL", "BILL"]),
        name: z.string().min(1).max(100),
        amount: z.string(),
        category: z.string().min(1).max(80).default('Lainnya'),
        date: z.iso.date(),
        recurrence: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
      })
      .parse(raw);
    return db.resource.create({
      data: {
        ...p,
        ...ownership,
        amount: amount(p.amount),
        date: new Date(p.date + "T05:00:00Z"),
      },
    });
  }
  if (action === "resourceUpdate") {
    const p = z
      .object({
        id: z.string(),
        name: z.string().min(1).max(100),
        amount: z.string(),
        date: z.iso.date(),
      })
      .parse(raw);
    const r = await db.resource.findFirst({ where: { id: p.id, ...where } });
    if (!r) throw new Error("Tidak ditemukan");
    return db.resource.update({
      where: { id: p.id },
      data: {
        name: p.name,
        amount: amount(p.amount),
        date: new Date(p.date + "T05:00:00Z"),
      },
    });
  }
  if (action === "fund" || action === "pay")
    return db.$transaction(
      async (tx) => {
        const p = z
          .object({
            id: z.string(),
            requestKey: z.string().uuid(),
            amount: z.string(),
            withdraw: z.boolean().default(false),
            walletId: z.string().optional(),
            period: z
              .string()
              .regex(/^\d{4}-\d{2}$/)
              .optional(),
          })
          .parse(raw);
        const r = await tx.resource.findFirst({
          where: { id: p.id, ...where },
        });
        if (!r) throw new Error("Tidak ditemukan");
        const previous = await tx.resourceEvent.findUnique({
          where: { requestKey: p.requestKey },
        });
        if (previous) {
          if (previous.creatorId !== userId) throw new Error("Akses ditolak");
          return previous;
        }
        if (action === "pay" && p.withdraw)
          throw new Error("Pembayaran tidak boleh bernilai negatif");
        const value = amount(p.amount) * (p.withdraw ? -1n : 1n);
        if (action === "fund") {
          if (r.kind !== "GOAL") throw new Error("Tujuan tidak valid");
          const current = await tx.resourceEvent.aggregate({
            where: { resourceId: r.id },
            _sum: { amount: true },
          });
          if ((current._sum.amount ?? 0n) + value < 0n)
            throw new Error("Penarikan melebihi dana tujuan");
        } else {
          if (r.kind !== "BILL" || !p.period)
            throw new Error("Periode wajib diisi");
          if (!p.walletId) throw new Error('Pilih dompet pembayaran');
          const wallet = await tx.wallet.findFirst({
            where: {
              id: p.walletId,
              ...where,
              householdId: r.householdId,
              archived: false,
            },
          });
          if (!wallet) throw new Error("Dompet pembayaran tidak sesuai");
          const billCategory = await tx.category.findFirst({
            where: {
              name: r.category,
              kind: "EXPENSE",
              householdId: r.householdId,
              ...(!r.householdId ? { ownerId: userId } : {}),
            },
          });
          await tx.posting.create({
            data: {
              requestKey: p.requestKey,
              creatorId: userId,
              kind: "EXPENSE",
              description: "Tagihan: " + r.name,
              date: ledgerToday(),
              entries: {
                create: {
                  creatorId: userId,
                  walletId: wallet.id,
                  categoryId: billCategory?.id,
                  amount: -value,
                },
              },
            },
          });
        }
        const event = await tx.resourceEvent.create({
          data: {
            resourceId: r.id,
            creatorId: userId,
            requestKey: p.requestKey,
            amount: value,
            period:
              action === "pay"
                ? r.recurrence === "YEARLY"
                  ? p.period!.slice(0, 4)
                  : p.period
                : null,
          },
        });
        if (action === "fund") {
          const sum = await tx.resourceEvent.aggregate({
            where: { resourceId: r.id },
            _sum: { amount: true },
          });
          if ((sum._sum.amount ?? 0n) >= r.amount) {
            const ids = r.householdId
              ? (
                  await tx.householdMember.findMany({
                    where: { householdId: r.householdId },
                  })
                ).map((m) => m.userId)
              : [userId];
            for (const id of ids)
              await notify(
                tx,
                id,
                "Tujuan tercapai: " + r.name,
                "goal:" + r.id + ":" + id,
              );
          }
        }
        return event;
      },
      { isolationLevel: "Serializable" },
    );
  if (action === "readNotifications")
    return db.notification.updateMany({
      where: { userId },
      data: { read: true },
    });
  if (action === "preferences")
    return db.user.update({
      where: { id: userId },
      data: { notificationsEnabled: raw.enabled === true },
      select: { id: true },
    });
  if (action === "savePlan") {
    if (!member) throw new Error("Belum ada rumah tangga");
    const p = z
      .object({
        amount: z.string(),
        method: z.enum(["equal", "percentage", "fixed", "income"]),
        firstWeight: z.string().regex(/^\d{1,15}$/),
      })
      .parse(raw);
    const total = amount(p.amount),
      weight = BigInt(p.firstWeight);
    if (
      (p.method === "percentage" && weight > 100n) ||
      (p.method === "fixed" && weight > total)
    )
      throw new Error("Bobot tidak valid");
    const values = { amount: total, method: p.method, firstWeight: weight };
    return db.contributionPlan.upsert({
      where: { householdId: member.householdId },
      create: { householdId: member.householdId, ...values },
      update: values,
    });
  }
  if (action === "declaredIncome") {
    if (!member) throw new Error("Belum ada rumah tangga");
    const income = z
      .string()
      .regex(/^\d{1,15}$/)
      .parse(raw.amount);
    return db.householdMember.update({
      where: { userId },
      data: { declaredIncome: BigInt(income) },
    });
  }
  throw new Error("Tindakan tidak dikenali");
}
