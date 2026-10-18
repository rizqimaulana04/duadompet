import { expect, it } from "vitest";
import { RuleBasedInsights } from "../src/lib/insights";
it("derives warnings from supplied financial facts without an external provider", async () => {
  const p = new RuleBasedInsights();
  expect(
    await p.analyze({
      income: 100n,
      expenses: 120n,
      previousExpenses: 100n,
      budgets: [{ name: "Makanan", used: 85n, limit: 100n }],
    }),
  ).toEqual([
    {
      code: "NEGATIVE_CASHFLOW",
      message: "Pengeluaran lebih besar dari pemasukan pada periode ini.",
    },
    {
      code: "SPENDING_INCREASE",
      message: "Pengeluaran naik lebih dari 10% dibanding periode sebelumnya.",
    },
    {
      code: "BUDGET_WARNING",
      message: "Anggaran Makanan sudah terpakai setidaknya 80%.",
    },
  ]);
  expect(
    await p.analyze({
      income: 0n,
      expenses: 0n,
      previousExpenses: 0n,
      budgets: [],
    }),
  ).toEqual([]);
});
