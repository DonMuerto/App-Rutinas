import { describe, expect, it } from "vitest";

import { localDateSchema, scheduledTimeSchema } from "@/lib/contracts";

import { getLocalDate } from "./local-date";

describe("local date contracts", () => {
  it("rejects impossible calendar dates", () => {
    expect(localDateSchema.safeParse("2025-02-29").success).toBe(false);
    expect(localDateSchema.safeParse("2024-02-29").success).toBe(true);
  });

  it("validates 24-hour civil times", () => {
    expect(scheduledTimeSchema.safeParse("00:00").success).toBe(true);
    expect(scheduledTimeSchema.safeParse("23:59").success).toBe(true);
    expect(scheduledTimeSchema.safeParse("24:00").success).toBe(false);
  });
});

describe("getLocalDate", () => {
  it("uses local calendar fields rather than an ISO UTC projection", () => {
    const localInstant = new Date(2026, 0, 2, 0, 30);

    expect(getLocalDate(localInstant)).toBe("2026-01-02");
  });
});
