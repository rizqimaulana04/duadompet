import { expect, it } from "vitest";
import { nextBillDate } from "../src/lib/bills";
it("clamps month ends and skips paid periods without drifting the due day", () => {
  expect(
    nextBillDate("2026-01-31T05:00:00Z", "MONTHLY", [], new Date("2026-02-01"))
      .toISOString()
      .slice(0, 10),
  ).toBe("2026-02-28");
  expect(
    nextBillDate(
      "2026-01-31T05:00:00Z",
      "MONTHLY",
      ["2026-02"],
      new Date("2026-02-01"),
    )
      .toISOString()
      .slice(0, 10),
  ).toBe("2026-03-31");
  expect(
    nextBillDate(
      "2024-02-29T05:00:00Z",
      "YEARLY",
      ["2026"],
      new Date("2026-01-01"),
    )
      .toISOString()
      .slice(0, 10),
  ).toBe("2027-02-28");
});
