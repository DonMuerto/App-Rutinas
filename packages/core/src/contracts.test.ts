import { describe, expect, it } from "vitest";

import {
  activityScheduledTimeSchema,
  activityTimerConfigSchema,
  completionKeySchema,
  getLocalDate,
  localDateSchema,
  routineSchema,
  scheduledTimeSchema,
} from "./index";

const routineId = "6dc5a254-20d1-4a58-bb25-f872847aad1b";

describe("activity contracts", () => {
  it("accepts inclusive timer limits and ignores inactive values", () => {
    expect(
      activityTimerConfigSchema.parse({
        timerType: "countdown",
        countdownSeconds: 86_400,
      }),
    ).toEqual({ timerType: "countdown", countdownSeconds: 86_400 });
    expect(
      activityTimerConfigSchema.parse({
        timerType: "none",
        countdownSeconds: -1,
      }),
    ).toEqual({ timerType: "none" });
  });

  it("normalizes the BlockNote time sentinel", () => {
    expect(activityScheduledTimeSchema.parse("")).toBeUndefined();
  });
});

describe("date contracts", () => {
  it("validates civil dates and times", () => {
    expect(localDateSchema.safeParse("2025-02-29").success).toBe(false);
    expect(localDateSchema.safeParse("2024-02-29").success).toBe(true);
    expect(scheduledTimeSchema.safeParse("23:59").success).toBe(true);
    expect(scheduledTimeSchema.safeParse("24:00").success).toBe(false);
  });

  it("uses local calendar fields instead of UTC projection", () => {
    expect(getLocalDate(new Date(2026, 0, 2, 0, 30))).toBe("2026-01-02");
  });
});

describe("domain contracts", () => {
  it("requires an Activity completion to own its scope", () => {
    expect(
      completionKeySchema.safeParse({
        routineId,
        scopeActivityBlockId: "activity-a",
        blockId: "activity-b",
        blockType: "activity",
        completionDate: "2026-09-13",
      }).success,
    ).toBe(false);
  });

  it("requires a non-negative document revision", () => {
    expect(
      routineSchema.safeParse({
        id: routineId,
        name: "Noche",
        icon: null,
        position: 0,
        recurrenceType: "daily",
        specificDate: null,
        content: { schemaVersion: 1, blocks: [] },
        revision: -1,
      }).success,
    ).toBe(false);
  });
});
