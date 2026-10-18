import { addMonths, addYears } from "date-fns";
export function nextBillDate(
  start: string,
  recurrence: string,
  paidPeriods: (string | null)[],
  reference = new Date(),
): Date {
  const original = new Date(start);
  const year = reference.getUTCFullYear(),
    month = reference.getUTCMonth();
  const candidate = (y: number, m: number) =>
    new Date(
      Date.UTC(
        y,
        m,
        Math.min(
          original.getUTCDate(),
          new Date(Date.UTC(y, m + 1, 0)).getUTCDate(),
        ),
        5,
      ),
    );
  let due =
    recurrence === "YEARLY"
      ? candidate(year, original.getUTCMonth())
      : candidate(year, month);
  if (due < original) due = original;
  for (let i = 0; i < 1200; i++) {
    const key =
      recurrence === "YEARLY"
        ? due.toISOString().slice(0, 4)
        : due.toISOString().slice(0, 7);
    if (!paidPeriods.includes(key)) return due;
    const next = recurrence === "YEARLY" ? addYears(due, 1) : addMonths(due, 1);
    due = candidate(next.getUTCFullYear(), next.getUTCMonth());
  }
  throw new Error("Terlalu banyak periode pembayaran");
}
