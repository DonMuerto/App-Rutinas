import { describe, expect, it } from "vitest";

import {
  parseRunnableTimerConfig,
  TimerValidationError,
  validateRunnableTimerConfig,
} from "./validation";

describe("canonical timer validation", () => {
  it("accepts inclusive countdown and interval limits", () => {
    expect(
      validateRunnableTimerConfig({
        timerType: "countdown",
        countdownSeconds: 60,
      }).success,
    ).toBe(true);
    expect(
      validateRunnableTimerConfig({
        timerType: "countdown",
        countdownSeconds: 86_400,
      }).success,
    ).toBe(true);
    expect(
      validateRunnableTimerConfig({
        timerType: "interval",
        prepareSeconds: 0,
        workSeconds: 3_600,
        restSeconds: 0,
        cycles: 100,
        sets: 20,
        restBetweenSetsSeconds: 3_600,
      }).success,
    ).toBe(true);
  });

  it.each([-1, 60.5, Number.POSITIVE_INFINITY, 59, 86_401])(
    "rejects invalid countdown value %s",
    (countdownSeconds) => {
      expect(
        validateRunnableTimerConfig({
          timerType: "countdown",
          countdownSeconds,
        }).success,
      ).toBe(false);
    },
  );

  it("rejects disabled timers for Start", () => {
    const result = validateRunnableTimerConfig({ timerType: "none" });

    expect(result).toMatchObject({ success: false });
    expect(() => parseRunnableTimerConfig({ timerType: "none" })).toThrow(
      TimerValidationError,
    );
  });
});
