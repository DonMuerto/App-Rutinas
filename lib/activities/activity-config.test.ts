import { describe, expect, it } from "vitest";

import {
  formatDuration,
  getActivityDurationSeconds,
  inspectActivityProps,
} from "./activity-config";

describe("activity configuration", () => {
  it("ignores inactive values and validates the active countdown", () => {
    const result = inspectActivityProps({
      schemaVersion: 1,
      scheduledTime: "07:30",
      timerType: "countdown",
      countdownSeconds: 1_800,
      workSeconds: "not-used",
    });

    expect(result).toEqual({
      schemaVersionValid: true,
      scheduledTime: "07:30",
      scheduledTimeError: undefined,
      timer: {
        status: "ready",
        config: { timerType: "countdown", countdownSeconds: 1_800 },
      },
    });
  });

  it("keeps invalid activity props editable but disables Start", () => {
    const result = inspectActivityProps({
      schemaVersion: 1,
      scheduledTime: "25:00",
      timerType: "countdown",
      countdownSeconds: 59,
    });

    expect(result.scheduledTime).toBeUndefined();
    expect(result.scheduledTimeError).toBeDefined();
    expect(result.timer.status).toBe("invalid");
  });

  it("rejects timer controls from an unsupported Activity version", () => {
    const result = inspectActivityProps({
      schemaVersion: 2,
      scheduledTime: "07:30",
      timerType: "countdown",
      countdownSeconds: 1_800,
    });

    expect(result.schemaVersionValid).toBe(false);
    expect(result.timer).toMatchObject({
      status: "invalid",
      message: "La version de Activity no es compatible.",
    });
  });

  it("sums interval phases without nonexistent final rests", () => {
    const duration = getActivityDurationSeconds({
      status: "ready",
      config: {
        timerType: "interval",
        prepareSeconds: 10,
        workSeconds: 20,
        restSeconds: 10,
        cycles: 3,
        sets: 2,
        restBetweenSetsSeconds: 60,
      },
    });

    expect(duration).toBe(230);
    expect(formatDuration(duration ?? 0)).toBe("3 min 50 s");
  });
});
