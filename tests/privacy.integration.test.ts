import { describe, it, expect, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { mutate, post, snapshot } from "../src/lib/service";
const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
// Use a disposable database. Never point TEST_DATABASE_URL at a production DB.
if (process.env.TEST_DATABASE_URL)
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
suite("PostgreSQL financial authorization", () => {
  afterAll(async () => {
    await db.$disconnect();
  });
  it("ignores future-month expenses in current-month budget insights", async () => {
    const user = await db.user.create({
      data: {
        name: "Period test",
        email: `period-${randomUUID()}@example.invalid`,
        password: "test-only",
      },
    });
    const wallet = (await mutate(user.id, "wallet", {
      name: "Period wallet",
      type: "BANK",
      openingBalance: "1000",
    })) as { id: string };
    const current = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const start = new Date(current.slice(0, 7) + "-01T00:00:00Z");
    const future = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 10),
    )
      .toISOString()
      .slice(0, 10);
    await mutate(user.id, "resource", {
      kind: "BUDGET",
      name: "Current budget",
      amount: "100",
      category: "Lainnya",
      date: current,
    });
    await post(user.id, {
      requestKey: randomUUID(),
      kind: "EXPENSE",
      walletId: wallet.id,
      amount: "1000",
      description: "Future expense",
      date: future,
    });
    expect(
      (await snapshot(user.id)).insights.personal.some(
        (i) => i.code === "BUDGET_WARNING",
      ),
    ).toBe(false);
    await post(user.id, {
      requestKey: randomUUID(),
      kind: "EXPENSE",
      walletId: wallet.id,
      amount: "90",
      description: "Current expense",
      date: current,
    });
    expect(
      (await snapshot(user.id)).insights.personal.some(
        (i) => i.code === "BUDGET_WARNING",
      ),
    ).toBe(true);
  });
  it("posts a concurrent transfer request exactly once", async () => {
    const user = await db.user.create({
      data: {
        name: "Race test",
        email: `race-${randomUUID()}@example.invalid`,
        password: "test-only",
      },
    });
    const a = (await mutate(user.id, "wallet", {
      name: "A",
      type: "BANK",
      openingBalance: "1000",
    })) as { id: string };
    const b = (await mutate(user.id, "wallet", {
      name: "B",
      type: "BANK",
      openingBalance: "0",
    })) as { id: string };
    const request = {
      requestKey: randomUUID(),
      kind: "TRANSFER",
      walletId: a.id,
      destinationId: b.id,
      amount: "100",
      description: "Concurrent transfer",
      date: "2026-10-17",
    };
    const results = await Promise.allSettled([
      post(user.id, request),
      post(user.id, request),
    ]);
    expect(results.some((r) => r.status === "fulfilled")).toBe(true);
    await post(user.id, request);
    expect(
      await db.posting.count({ where: { requestKey: request.requestKey } }),
    ).toBe(1);
    await expect(post(user.id, {...request, walletId:b.id, destinationId:undefined, requestKey:randomUUID()})).rejects.toThrow();
    const data = await snapshot(user.id);
    expect(data.wallets.find((w) => w.id === a.id)?.balance).toBe(900n);
    expect(data.wallets.find((w) => w.id === b.id)?.balance).toBe(100n);
  });
  it("enforces privacy, atomic transfers, retries, edits and deletion", async () => {
    const unique = randomUUID();
    const a = await db.user.create({
      data: {
        name: "Test A",
        email: `a-${unique}@example.invalid`,
        password: "test-only",
      },
    });
    const b = await db.user.create({
      data: {
        name: "Test B",
        email: `b-${unique}@example.invalid`,
        password: "test-only",
      },
    });
    const c = await db.user.create({
      data: {
        name: "Test C",
        email: `c-${unique}@example.invalid`,
        password: "test-only",
      },
    });
    const wa = (await mutate(a.id, "wallet", {
      name: "Private A",
      type: "BANK",
      openingBalance: "1000",
    })) as { id: string };
    const wb = (await mutate(b.id, "wallet", {
      name: "Private B",
      type: "BANK",
      openingBalance: "2000",
    })) as { id: string };
    await mutate(a.id, "household", { name: "A & B" });
    const inv = (await mutate(a.id, "invite", { email: b.email })) as {
      link: string;
    };
    await mutate(b.id, "accept", {
      token: new URL(inv.link).searchParams.get("token"),
    });
    await expect(
      mutate(b.id, "accept", {
        token: new URL(inv.link).searchParams.get("token"),
      }),
    ).rejects.toThrow();
    const ws = (await mutate(a.id, "wallet", {
      name: "Shared",
      type: "BANK",
      openingBalance: "0",
      shared: true,
    })) as { id: string };
    await mutate(c.id, "household", { name: "Another household" });
    const wc = (await mutate(c.id, "wallet", {
      name: "Other shared",
      type: "BANK",
      openingBalance: "0",
      shared: true,
    })) as { id: string };
    expect((await snapshot(a.id)).wallets.map((w) => w.id)).not.toContain(
      wb.id,
    );
    expect((await snapshot(a.id)).wallets.map((w) => w.id)).not.toContain(
      wc.id,
    );
    expect((await snapshot(b.id)).wallets.map((w) => w.id)).not.toContain(
      wa.id,
    );
    expect((await snapshot(c.id)).wallets.map((w) => w.id)).not.toContain(
      ws.id,
    );
    const request = {
      requestKey: randomUUID(),
      kind: "CONTRIBUTION",
      walletId: wa.id,
      destinationId: ws.id,
      amount: "250",
      description: "Shared contribution",
      date: "2026-10-17",
    };
    const p = await post(a.id, request);
    await post(a.id, request);
    expect(
      (await snapshot(a.id)).wallets.find((w) => w.id === wa.id)?.balance,
    ).toBe(750n);
    expect(
      (await snapshot(b.id)).wallets.find((w) => w.id === ws.id)?.balance,
    ).toBe(250n);
    expect(
      (await snapshot(b.id)).entries.some((e) => e.walletId === wa.id),
    ).toBe(false);
    await expect(
      post(b.id, {
        ...request,
        requestKey: randomUUID(),
        walletId: wb.id,
        id: p.id,
      }),
    ).rejects.toThrow();
    await expect(
      post(c.id, { ...request, requestKey: randomUUID(), walletId: ws.id }),
    ).rejects.toThrow();
    await expect(
      post(a.id, {
        ...request,
        requestKey: randomUUID(),
        destinationId: wb.id,
      }),
    ).rejects.toThrow();
    await post(a.id, {
      ...request,
      id: p.id,
      requestKey: randomUUID(),
      amount: "100",
    });
    await post(a.id, request);
    expect(
      (await snapshot(a.id)).wallets.find((w) => w.id === wa.id)?.balance,
    ).toBe(900n);
    await mutate(a.id, "deletePosting", { id: p.id });
    await post(a.id, request);
    expect(
      (await snapshot(a.id)).wallets.find((w) => w.id === wa.id)?.balance,
    ).toBe(1000n);
    expect(
      (await snapshot(b.id)).wallets.find((w) => w.id === ws.id)?.balance,
    ).toBe(0n);
  });
  it("deduplicates goal allocations and bill payments and rejects overspending allocations", async () => {
    const user = await db.user.create({
      data: {
        name: "Goals test",
        email: `goals-${randomUUID()}@example.invalid`,
        password: "test-only",
      },
    });
    const w = (await mutate(user.id, "wallet", {
      name: "Test",
      type: "BANK",
      openingBalance: "1000",
    })) as { id: string };
    const goal = (await mutate(user.id, "resource", {
      kind: "GOAL",
      name: "Dana darurat",
      amount: "1000",
      category: "Lainnya",
      date: "2026-12-01",
    })) as { id: string };
    const fund = { id: goal.id, requestKey: randomUUID(), amount: "250" };
    await mutate(user.id, "fund", fund);
    await mutate(user.id, "fund", fund);
    await expect(
      mutate(user.id, "fund", {
        ...fund,
        requestKey: randomUUID(),
        amount: "251",
        withdraw: true,
      }),
    ).rejects.toThrow();
    expect(
      (await snapshot(user.id)).resources
        .find((r) => r.id === goal.id)
        ?.events.reduce((s, e) => s + e.amount, 0n),
    ).toBe(250n);
    expect(
      (await snapshot(user.id)).wallets.find((x) => x.id === w.id)?.balance,
    ).toBe(1000n);
    const bill = (await mutate(user.id, "resource", {
      kind: "BILL",
      name: "Internet",
      amount: "100",
      category: "Internet",
      date: "2026-10-20",
    })) as { id: string };
    const payment = {
      id: bill.id,
      requestKey: randomUUID(),
      amount: "100",
      period: "2026-10",
      walletId: w.id,
    };
    await mutate(user.id, "pay", payment);
    await mutate(user.id, "pay", payment);
    await expect(mutate(user.id, 'pay', {...payment, walletId:undefined, period:'2026-11', requestKey:randomUUID()})).rejects.toThrow();
    await expect(
      mutate(user.id, "pay", { ...payment, requestKey: randomUUID() }),
    ).rejects.toThrow();
    expect(
      (await snapshot(user.id)).wallets.find((x) => x.id === w.id)?.balance,
    ).toBe(900n);
    await expect(
      mutate(user.id, "pay", {
        ...payment,
        requestKey: randomUUID(),
        period: "2026-11",
        withdraw: true,
      }),
    ).rejects.toThrow();
  });
});
