export const money = (value: string | bigint | number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(BigInt(value));
export function amount(value: unknown): bigint {
  if (typeof value !== "string" || !/^[1-9]\d{0,14}$/.test(value))
    throw new Error(
      "Nominal harus bilangan rupiah positif, maksimal 15 digit.",
    );
  return BigInt(value);
}
export function percent(used: bigint, target: bigint) {
  return target > 0n ? Number((used * 10000n) / target) / 100 : 0;
}
export function split(total: bigint, weights: bigint[]) {
  if (
    total < 0n ||
    !weights.length ||
    weights.some((x) => x < 0n) ||
    weights.reduce((a, b) => a + b, 0n) === 0n
  )
    throw new Error("Pembagian tidak valid");
  const sum = weights.reduce((a, b) => a + b, 0n);
  const result = weights.map((w) => (total * w) / sum);
  let remainder = total - result.reduce((a, b) => a + b, 0n);
  for (let i = 0; remainder > 0n; i++, remainder--) result[i % result.length]++;
  return result;
}
export function totals(entries: { amount: bigint; kind: string }[]) {
  return entries.reduce(
    (a, e) => ({
      income: a.income + (e.kind === "INCOME" ? e.amount : 0n),
      expense: a.expense + (e.kind === "EXPENSE" ? -e.amount : 0n),
      balance: a.balance + e.amount,
    }),
    { income: 0n, expense: 0n, balance: 0n },
  );
}
export const incomeCategories = [
  "Gaji",
  "Bonus",
  "Freelance",
  "Usaha",
  "Investasi",
  "Hadiah",
  "Lainnya",
];
export const expenseCategories = [
  "Makanan",
  "Belanja Bulanan",
  "Transportasi",
  "Listrik",
  "Air",
  "Internet",
  "Cicilan",
  "Kesehatan",
  "Pendidikan",
  "Hiburan",
  "Kebutuhan Anak",
  "Rumah Tangga",
  "Lainnya",
];
