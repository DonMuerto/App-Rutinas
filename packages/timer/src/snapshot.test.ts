import { describe, expect, it } from "vitest";

import type { TimerSnapshotEnvelope } from "@ritmo/platform";

import { startTimer, tickTimer } from "./engine";
import {
  deserializeTimerSnapshot,
  restoreTimerSnapshot,
  serializeTimerSnapshot,
} from "./snapshot";

const identity = { userId: "user-a", contextId: "tab-a" } as const;
const origin = {
  activityId: "activity-a",
  activityTitle: "Lectura",
  routineId: "routine-a",
  routineName: "Noche",
} as const;

function runningState() {
  return startTimer(
    {
      config: { timerType: "countdown", countdownSeconds: 60 },
      origin,
    },
    1_000,
  );
}

describe("timer snapshot serialization", () => {
  it("serializes a versioned running snapshot and restores it", () => {
    const envelope = serializeTimerSnapshot(runningState(), identity, 2_000);

    expect(envelope).toMatchObject({
      version: 1,
      userId: "user-a",
      contextId: "tab-a",
      updatedAt: 2_000,
    });

    const parsed = deserializeTimerSnapshot(envelope, identity);
    expect(parsed.success).toBe(true);

    if (!parsed.success) {
      throw new Error("Expected a valid snapshot.");
    }

    expect(restoreTimerSnapshot(parsed.snapshot, 31_000)).toMatchObject({
      status: "restored",
      state: { status: "running", remainingSeconds: 30 },
    });
  });

  it("restores after crossing multiple persisted phases", () => {
    const state = startTimer(
      {
        config: {
          timerType: "interval",
          prepareSeconds: 10,
          workSeconds: 20,
          restSeconds: 10,
          cycles: 3,
          sets: 1,
          restBetweenSetsSeconds: 0,
        },
        origin,
      },
      0,
    );
    const envelope = serializeTimerSnapshot(state, identity, 1_000);
    const parsed = deserializeTimerSnapshot(envelope, identity);

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw new Error("Expected a valid snapshot.");
    }

    const restored = restoreTimerSnapshot(parsed.snapshot, 75_000);
    expect(restored).toMatchObject({
      status: "reconciled",
      state: { status: "running", phase: { kind: "work", cycle: 3 } },
    });
    expect(
      restored.status === "reconciled" ? restored.transitions.length : 0,
    ).toBe(5);
  });

  it("restores done without replaying transitions", () => {
    const done = tickTimer(runningState(), 61_000).state;
    if (done.status !== "done") {
      throw new Error("Expected a done timer.");
    }

    const envelope = serializeTimerSnapshot(done, identity, 62_000);
    const parsed = deserializeTimerSnapshot(envelope, identity);
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw new Error("Expected a valid snapshot.");
    }

    expect(restoreTimerSnapshot(parsed.snapshot, 100_000)).toMatchObject({
      status: "restored",
      state: { status: "done", completedAt: 61_000 },
      transitions: [],
    });
  });

  it.each([
    ["corrupt payload", { payload: null }],
    ["wrong version", { version: 2 }],
  ])("discards %s", (_label, changes) => {
    const envelope = serializeTimerSnapshot(runningState(), identity, 2_000);
    const corrupt = {
      ...envelope,
      ...changes,
    } as unknown as TimerSnapshotEnvelope;

    expect(deserializeTimerSnapshot(corrupt, identity)).toMatchObject({
      success: false,
      reason: "invalid",
    });
  });

  it("rejects a snapshot for another user or context", () => {
    const envelope = serializeTimerSnapshot(runningState(), identity, 2_000);

    expect(
      deserializeTimerSnapshot(envelope, {
        userId: "user-b",
        contextId: "tab-a",
      }),
    ).toEqual({ success: false, reason: "user-mismatch" });
    expect(
      deserializeTimerSnapshot(envelope, {
        userId: "user-a",
        contextId: "tab-b",
      }),
    ).toEqual({ success: false, reason: "context-mismatch" });
  });

  it("rejects a null value before reading envelope fields", () => {
    expect(deserializeTimerSnapshot(null, identity)).toEqual({
      success: false,
      reason: "invalid",
    });
  });

  it("classifies an incomplete payload as corrupt", () => {
    const envelope = serializeTimerSnapshot(runningState(), identity, 2_000);

    expect(
      deserializeTimerSnapshot(
        { ...envelope, payload: { version: 1 } },
        identity,
      ),
    ).toEqual({ success: false, reason: "invalid" });
  });
});
