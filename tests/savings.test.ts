import { expect, it } from "vitest";
import { estimatedCompletion } from "../src/lib/savings";
it("estimates only from a positive recorded savings history of at least seven days", () => {
  expect(estimatedCompletion([], "1000")).toBeNull();
  expect(
    estimatedCompletion(
      [{ amount: "100", createdAt: "2026-01-01" }],
      "200",
      new Date("2026-01-11"),
    ),
  ).toBe("2026-01-21T00:00:00.000Z");
  expect(
    estimatedCompletion(
      [
        { amount: "100", createdAt: "2026-01-01" },
        { amount: "-100", createdAt: "2026-01-03" },
      ],
      "200",
      new Date("2026-01-11"),
    ),
  ).toBeNull();
});
