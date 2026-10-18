export type Insight = { code: string; message: string };
export type InsightInput = {
  income: bigint;
  expenses: bigint;
  previousExpenses: bigint;
  budgets: { name: string; used: bigint; limit: bigint }[];
};
export interface InsightProvider {
  analyze(input: InsightInput): Promise<Insight[]>;
}
// No outbound API calls. Any future external provider must require explicit consent.
export class RuleBasedInsights implements InsightProvider {
  async analyze(input: InsightInput) {
    const result: Insight[] = [];
    if (input.expenses > input.income)
      result.push({
        code: "NEGATIVE_CASHFLOW",
        message: "Pengeluaran lebih besar dari pemasukan pada periode ini.",
      });
    if (
      input.previousExpenses > 0n &&
      input.expenses * 100n > input.previousExpenses * 110n
    )
      result.push({
        code: "SPENDING_INCREASE",
        message:
          "Pengeluaran naik lebih dari 10% dibanding periode sebelumnya.",
      });
    for (const b of input.budgets)
      if (b.used * 100n >= b.limit * 80n && b.limit > 0n)
        result.push({
          code: "BUDGET_WARNING",
          message: `Anggaran ${b.name} sudah terpakai setidaknya 80%.`,
        });
    return result;
  }
}
