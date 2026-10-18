import { describe, it, expect } from "vitest";
import { amount, split, percent, totals } from "../src/lib/finance";
describe("Exact integer rupiah", () => {
  it("rejects floating amounts, signs, exponents and zero", () => {
    for (const value of ["1.5", "1e4", "-1", "0", "1,000", "1000000000000000"])
      expect(() => amount(value)).toThrow();
    expect(amount("999999999999999")).toBe(999999999999999n);
  });
  it("preserves amounts beyond Number safe integer during totals", () => {
    const n = 9007199254740999n;
    expect(
      totals([
        { amount: n, kind: "INCOME" },
        { amount: -1000n, kind: "EXPENSE" },
      ]),
    ).toEqual({ income: n, expense: 1000n, balance: n - 1000n });
  });
  it("transfer pair does not create income or expense", () =>
    expect(
      totals([
        { amount: -123456n, kind: "CONTRIBUTION" },
        { amount: 123456n, kind: "CONTRIBUTION" },
      ]),
    ).toEqual({ income: 0n, expense: 0n, balance: 0n }));
  it("keeps every rupiah when dividing contributions", () => {
    expect(split(101n, [1n, 1n])).toEqual([51n, 50n]);
    expect(split(5000000n, [60n, 40n])).toEqual([3000000n, 2000000n]);
    expect(split(110n, [6n, 5n])).toEqual([60n, 50n]);
  });
  it("rejects invalid splits", () => {
    expect(() => split(100n, [0n, 0n])).toThrow();
    expect(() => split(100n, [-1n, 2n])).toThrow();
  });
  it("reports budget usage and savings progress without floating money", () => {
    expect(percent(1700000n, 2000000n)).toBe(85);
    expect(percent(150n, 100n)).toBe(150);
    expect(percent(1n, 0n)).toBe(0);
  });
});
