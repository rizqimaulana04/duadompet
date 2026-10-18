import { hash } from "bcryptjs";
import { expenseCategories, incomeCategories } from "../src/lib/finance";
import { db } from "../src/lib/db";
import { mutate, post } from "../src/lib/service";
async function seed() {
  if (
    process.env.ENABLE_DEMO !== "true" ||
    process.env.NODE_ENV === "production"
  )
    throw new Error(
      "Demo seed requires ENABLE_DEMO=true and a development database",
    );
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 12)
    throw new Error(
      "Set DEMO_PASSWORD (12+ characters). Never use this database for real users.",
    );
  const encoded = await hash(password, 12);
  for (const [name, email] of [
    ["Nadia Demo", "nadia@demo.invalid"],
    ["Raka Demo", "raka@demo.invalid"],
  ]) {
    if (await db.user.findUnique({ where: { email } })) continue;
    await db.user.create({
      data: {
        name,
        email,
        password: encoded,
        categories: {
          create: [
            ...incomeCategories.map((name) => ({ name, kind: "INCOME" })),
            ...expenseCategories.map((name) => ({ name, kind: "EXPENSE" })),
          ],
        },
        wallets: {
          create: {
            name: "Dompet demo",
            type: "BANK",
            openingBalance: 5000000n,
          },
        },
      },
    });
  }
  const a = await db.user.findUniqueOrThrow({
      where: { email: "nadia@demo.invalid" },
    }),
    b = await db.user.findUniqueOrThrow({
      where: { email: "raka@demo.invalid" },
    });
  if (!(await db.householdMember.findUnique({ where: { userId: a.id } }))) {
    await mutate(a.id, "household", { name: "Rumah Nadia & Raka (Demo)" });
    const invite = (await mutate(a.id, "invite", { email: b.email })) as {
      link: string;
    };
    await mutate(b.id, "accept", {
      token: new URL(invite.link).searchParams.get("token"),
    });
  }
  const member = await db.householdMember.findUniqueOrThrow({
    where: { userId: a.id },
  });
  let shared = await db.wallet.findFirst({
    where: { householdId: member.householdId },
  });
  if (!shared)
    shared = await db.wallet.create({
      data: {
        name: "Rekening bersama demo",
        type: "BANK",
        ownerId: a.id,
        householdId: member.householdId,
        openingBalance: 2000000n,
      },
    });
  const wa = await db.wallet.findFirstOrThrow({
      where: { ownerId: a.id, householdId: null },
    }),
    wb = await db.wallet.findFirstOrThrow({
      where: { ownerId: b.id, householdId: null },
    });
  const month = new Date().toISOString().slice(0, 7);
  for (const [
    index,
    owner,
    walletId,
    kind,
    value,
    description,
    destinationId,
  ] of [
    [1, a.id, wa.id, "INCOME", "6000000", "Gaji Nadia demo", undefined],
    [2, b.id, wb.id, "INCOME", "5000000", "Gaji Raka demo", undefined],
    [
      3,
      a.id,
      wa.id,
      "CONTRIBUTION",
      "3000000",
      "Kontribusi Nadia demo",
      shared.id,
    ],
    [
      4,
      b.id,
      wb.id,
      "CONTRIBUTION",
      "2000000",
      "Kontribusi Raka demo",
      shared.id,
    ],
    [
      5,
      a.id,
      shared.id,
      "EXPENSE",
      "1700000",
      "Belanja bulanan demo",
      undefined,
    ],
    [6, b.id, shared.id, "EXPENSE", "350000", "Internet demo", undefined],
  ] as const) {
    await post(owner, {
      requestKey: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      kind,
      walletId,
      destinationId,
      amount: value,
      description,
      date: month + "-05",
    });
  }
  if (
    !(await db.resource.findFirst({
      where: { ownerId: a.id, name: "DP Rumah (Demo)" },
    }))
  ) {
    const goal = await db.resource.create({
      data: {
        kind: "GOAL",
        name: "DP Rumah (Demo)",
        ownerId: a.id,
        householdId: member.householdId,
        amount: 150000000n,
        date: new Date("2028-12-01"),
      },
    });
    await mutate(a.id, "fund", {
      id: goal.id,
      requestKey: "00000000-0000-4000-8000-000000000007",
      amount: "45000000",
    });
    await mutate(a.id, "resource", {
      kind: "BUDGET",
      name: "Belanja (Demo)",
      amount: "2500000",
      category: "Lainnya",
      date: month + "-01",
      shared: true,
    });
    await mutate(a.id, "resource", {
      kind: "BILL",
      name: "Internet (Demo)",
      amount: "350000",
      category: "Internet",
      date: month + "-25",
      shared: true,
    });
  }
  console.info(
    "Created isolated demo accounts and household sample records. Reset by recreating the disposable demo database.",
  );
}
seed().finally(() => db.$disconnect());
