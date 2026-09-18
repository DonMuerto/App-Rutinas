import { describe, expect, it } from "vitest";

import {
  parseRunnableTimerConfig,
  TimerValidationError,
  validateRunnableTimerConfig,
} from "./validation";

describe("validateRunnableTimerConfig", () => {
  it("accepts countdown and interval boundary values", () => {
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

  it.each([
    ["negative", -1],
    ["decimal", 60.5],
    ["infinite", Number.POSITIVE_INFINITY],
    ["below range", 59],
    ["above range", 86_401],
  ])("rejects a %s countdown", (_case, countdownSeconds) => {
    expect(
      validateRunnableTimerConfig({
        timerType: "countdown",
        countdownSeconds,
      }).success,
    ).toBe(false);
  });

  it("rejects invalid values in every active interval field", () => {
    const validInterval = {
      timerType: "interval",
      prepareSeconds: 10,
      workSeconds: 20,
      restSeconds: 10,
      cycles: 8,
      sets: 2,
      restBetweenSetsSeconds: 60,
    } as const;

    for (const [field, value] of [
      ["prepareSeconds", -1],
      ["workSeconds", 0],
      ["restSeconds", 3_601],
      ["cycles", 1.5],
      ["sets", Number.POSITIVE_INFINITY],
      ["restBetweenSetsSeconds", -1],
    ] as const) {
      expect(
        validateRunnableTimerConfig({
          ...validInterval,
          [field]: value,
        }).success,
      ).toBe(false);
    }
  });

  it("distinguishes a valid disabled timer from a runnable timer", () => {
    const result = validateRunnableTimerConfig({ timerType: "none" });

    expect(result).toEqual({
      success: false,
      issues: [
        {
          message: "La actividad no tiene un temporizador configurado.",
          path: ["timerType"],
        },
      ],
    });
  });

  it("offers a throwing parser for already-guarded call sites", () => {
    expect(() => parseRunnableTimerConfig({ timerType: "none" })).toThrow(
      TimerValidationError,
    );
  });
});
