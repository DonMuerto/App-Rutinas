import { describe, expect, it } from "vitest";

import {
  activityScheduledTimeSchema,
  activityTimerConfigSchema,
} from "./activity";

describe("activityTimerConfigSchema", () => {
  it("accepts the inclusive countdown limits", () => {
    expect(
      activityTimerConfigSchema.parse({
        timerType: "countdown",
        countdownSeconds: 60,
      }),
    ).toEqual({ timerType: "countdown", countdownSeconds: 60 });

    expect(
      activityTimerConfigSchema.parse({
        timerType: "countdown",
        countdownSeconds: 86_400,
      }),
    ).toEqual({ timerType: "countdown", countdownSeconds: 86_400 });
  });

  it("rejects an invalid active timer value", () => {
    expect(() =>
      activityTimerConfigSchema.parse({
        timerType: "interval",
        prepareSeconds: 0,
        workSeconds: 0,
        restSeconds: 0,
        cycles: 1,
        sets: 1,
        restBetweenSetsSeconds: 0,
      }),
    ).toThrow();
  });

  it("ignores values belonging to inactive timer modes", () => {
    expect(
      activityTimerConfigSchema.parse({
        timerType: "none",
        countdownSeconds: -1,
      }),
    ).toEqual({ timerType: "none" });
  });
});

describe("activityScheduledTimeSchema", () => {
  it("normalizes the BlockNote empty-string sentinel to absence", () => {
    expect(activityScheduledTimeSchema.parse("")).toBeUndefined();
    expect(activityScheduledTimeSchema.parse("23:59")).toBe("23:59");
  });
});
