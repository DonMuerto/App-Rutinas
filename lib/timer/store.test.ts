import { describe, expect, it, vi } from "vitest";

import type { TimerAudioAdapter } from "./audio";
import { createTimerStore, type TimerStartRequest } from "./store";

function countdownRequest(seconds = 60): TimerStartRequest {
  return {
    config: { timerType: "countdown", countdownSeconds: seconds },
    origin: {
      activityId: "activity-1",
      activityTitle: "Leer",
      routineId: "routine-1",
      routineName: "Noche",
    },
  };
}

function intervalRequest(): TimerStartRequest {
  return {
    config: {
      timerType: "interval",
      prepareSeconds: 10,
      workSeconds: 20,
      restSeconds: 10,
      cycles: 3,
      sets: 1,
      restBetweenSetsSeconds: 0,
    },
    origin: countdownRequest().origin,
  };
}

function setup() {
  let now = 0;
  const audio = {
    prepare: vi.fn(),
    play: vi.fn(),
  } satisfies TimerAudioAdapter;
  const store = createTimerStore({ audio, clock: { now: () => now } });

  return {
    audio,
    store,
    setNow(value: number) {
      now = value;
    },
  };
}

describe("createTimerStore", () => {
  it("rejects invalid input before preparing audio", () => {
    const { audio, store } = setup();
    const result = store.start({
      ...countdownRequest(),
      config: { timerType: "countdown", countdownSeconds: 59 },
    });

    expect(result).toMatchObject({ ok: false, reason: "invalid" });
    expect(store.getSnapshot().timer.status).toBe("idle");
    expect(audio.prepare).not.toHaveBeenCalled();
  });

  it("atomically keeps the first session when Start is called twice", () => {
    const { audio, store } = setup();

    expect(store.start(countdownRequest())).toEqual({ ok: true });
    const firstTimer = store.getSnapshot().timer;
    const conflict = store.start({
      ...countdownRequest(),
      origin: { ...countdownRequest().origin, activityId: "activity-2" },
    });

    expect(conflict).toMatchObject({
      ok: false,
      reason: "occupied",
      existing: { origin: { activityId: "activity-1" } },
    });
    expect(store.getSnapshot().timer).toBe(firstTimer);
    expect(audio.prepare).toHaveBeenCalledTimes(1);
  });

  it("retains an immutable origin and configuration snapshot", () => {
    const { store } = setup();
    const request = countdownRequest();
    const mutableOrigin = { ...request.origin };
    const mutableConfig = {
      timerType: "countdown" as const,
      countdownSeconds: 60,
    };

    store.start({ origin: mutableOrigin, config: mutableConfig });
    mutableOrigin.activityTitle = "Modificado";
    mutableConfig.countdownSeconds = 600;

    expect(store.getSnapshot().timer).toMatchObject({
      origin: { activityTitle: "Leer" },
      plan: { totalDurationSeconds: 60 },
    });
  });

  it("emits at most one sound after crossing several phases", () => {
    const { audio, setNow, store } = setup();
    store.start(intervalRequest());

    setNow(65_000);
    store.tick();

    expect(store.getSnapshot()).toMatchObject({
      timer: {
        status: "running",
        phase: { kind: "cycle-rest", cycle: 2 },
        deadline: 70_000,
      },
      signal: { id: 1, kind: "cycle-rest" },
    });
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(audio.play).toHaveBeenCalledWith("cycle-rest");
  });

  it("keeps done occupied until Dismiss", () => {
    const { setNow, store } = setup();
    store.start(countdownRequest());

    setNow(60_000);
    store.tick();

    expect(store.getSnapshot().timer.status).toBe("done");
    expect(store.start(countdownRequest())).toMatchObject({
      ok: false,
      reason: "occupied",
    });
    expect(store.cancel()).toBe(false);
    expect(store.dismiss()).toBe(true);
    expect(store.getSnapshot().timer.status).toBe("idle");
  });

  it("opens and closes focus without changing the active session", () => {
    const { store } = setup();
    store.start(countdownRequest());
    const timer = store.getSnapshot().timer;

    expect(store.closeFocus()).toBe(true);
    expect(store.getSnapshot()).toMatchObject({ focusOpen: false });
    expect(store.getSnapshot().timer).toBe(timer);
    expect(store.openFocus()).toBe(true);
    expect(store.getSnapshot()).toMatchObject({ focusOpen: true });
    expect(store.getSnapshot().timer).toBe(timer);
  });

  it("continues when browser audio is blocked", () => {
    let now = 0;
    const store = createTimerStore({
      clock: { now: () => now },
      audio: {
        prepare() {
          throw new Error("blocked");
        },
        play() {
          throw new Error("blocked");
        },
      },
    });

    expect(store.start(countdownRequest())).toEqual({ ok: true });
    expect(store.getSnapshot().timer.status).toBe("running");
    now = 60_000;
    expect(() => store.tick()).not.toThrow();
    expect(store.getSnapshot().timer.status).toBe("done");
  });

  it("notifies subscribers and stops after unsubscribe", () => {
    const { store } = setup();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.start(countdownRequest());
    unsubscribe();
    store.closeFocus();

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
