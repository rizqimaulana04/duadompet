import { expect, it } from "vitest";
import { inviteCallback } from "../src/lib/callback";
it("preserves only a valid local invitation callback", () => {
  const valid = "/household/invitations?token=" + "a".repeat(64);
  expect(inviteCallback(valid)).toBe(valid);
  for (const value of [
    null,
    "https://example.com",
    "//example.com",
    valid + "&next=https://example.com",
    "/api/data",
  ])
    expect(inviteCallback(value)).toBe("");
});
