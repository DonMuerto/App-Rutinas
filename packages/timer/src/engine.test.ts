import { describe, expect, it } from "vitest";

import {
  buildTimerPlan,
  cancelTimer,
  createTimerEngine,
  idleTimerState,
  startTimer,
  tickTimer,
  type TimerStartInput,
} from "./engine";

const origin = {
  activityId: "activity-1",
  activityTitle: "Entrenar",
  routineId: "routine-1",
  routineName: "Manana",
} as const;

function countdownInput(seconds = 60): TimerStartInput {
  return {
    config: { timerType: "countdown", countdownSeconds: seconds },
    origin,
  };
}

function intervalInput(
  overrides: Partial<{
    prepareSeconds: number;
    workSeconds: number;
    restSeconds: number;
    cycles: number;
    sets: number;
    restBetweenSetsSeconds: number;
  }> = {},
): TimerStartInput {
  return {
    config: {
      timerType: "interval",
      prepareSeconds: 10,
      workSeconds: 20,
      restSeconds: 10,
      cycles: 8,
      sets: 1,
      restBetweenSetsSeconds: 60,
      ...overrides,
    },
    origin,
  };
}

describe("buildTimerPlan", () => {
  it("creates one work phase for a countdown", () => {
    expect(buildTimerPlan(countdownInput().config)).toEqual({
      mode: "countdown",
      phases: [{ id: "work", kind: "work", durationSeconds: 60 }],
      totalDurationSeconds: 60,
    });
  });

  it("creates 10/20/10 x8 with one preparation and no final rest", () => {
    const plan = buildTimerPlan(intervalInput().config);
    const kinds = plan.phases.map((phase) => phase.kind);

    expect(kinds.filter((kind) => kind === "prepare")).toHaveLength(1);
    expect(kinds.filter((kind) => kind === "work")).toHaveLength(8);
    expect(kinds.filter((kind) => kind === "cycle-rest")).toHaveLength(7);
    expect(kinds.at(-1)).toBe("work");
    expect(plan.totalDurationSeconds).toBe(240);
  });

  it("creates one set rest between two sets", () => {
    const plan = buildTimerPlan(intervalInput({ cycles: 2, sets: 2 }).config);

    expect(plan.phases.map((phase) => phase.kind)).toEqual([
      "prepare",
      "work",
      "cycle-rest",
      "work",
      "set-rest",
      "work",
      "cycle-rest",
      "work",
    ]);
  });

  it("omits every optional zero-duration phase", () => {
    const plan = buildTimerPlan(
      intervalInput({
        prepareSeconds: 0,
        restSeconds: 0,
        cycles: 2,
        sets: 2,
        restBetweenSetsSeconds: 0,
      }).config,
    );

    expect(plan.phases.map((phase) => phase.kind)).toEqual([
      "work",
      "work",
      "work",
      "work",
    ]);
  });

  it("validates direct public engine input", () => {
    expect(() =>
      buildTimerPlan({ timerType: "countdown", countdownSeconds: 0 }),
    ).toThrow();
    expect(() =>
      startTimer(
        {
          config: {
            timerType: "interval",
            prepareSeconds: 0,
            workSeconds: 20,
            restSeconds: 0,
            cycles: 0,
            sets: 0,
            restBetweenSetsSeconds: 0,
          },
          origin,
        },
        0,
      ),
    ).toThrow();
  });
});

describe("timer transitions", () => {
  it("uses a deadline and rounds remaining time up", () => {
    const state = startTimer(countdownInput(), 1_000);

    expect(state.deadline).toBe(61_000);
    expect(state.remainingSeconds).toBe(60);
    expect(tickTimer(state, 1_001).state).toMatchObject({
      status: "running",
      remainingSeconds: 60,
    });
    expect(tickTimer(state, 60_999).state).toMatchObject({
      status: "running",
      remainingSeconds: 1,
    });
  });

  it("enters the next phase at the exact deadline", () => {
    const state = startTimer(intervalInput({ cycles: 2 }), 0);
    const update = tickTimer(state, 10_000);

    expect(update.state).toMatchObject({
      status: "running",
      phase: { kind: "work", cycle: 1, set: 1 },
      deadline: 30_000,
      remainingSeconds: 20,
      progress: 0,
    });
    expect(update.transitions).toHaveLength(1);
  });

  it("crosses multiple phases without rebasing deadlines", () => {
    const state = startTimer(intervalInput({ cycles: 3 }), 5_000);
    const update = tickTimer(state, 80_500);

    expect(update.state).toMatchObject({
      status: "running",
      phase: { kind: "work", cycle: 3, set: 1 },
      phaseStartedAt: 75_000,
      deadline: 95_000,
      remainingSeconds: 15,
      progress: 0.275,
    });
    expect(update.transitions).toHaveLength(5);
  });

  it("finishes at the original total deadline after a long suspension", () => {
    const state = startTimer(intervalInput({ cycles: 2 }), 2_000);
    const update = tickTimer(state, 1_000_000);

    expect(update.state).toMatchObject({
      status: "done",
      completedAt: 62_000,
    });
    expect(update.transitions.at(-1)?.type).toBe("done");
  });

  it("never returns to an elapsed phase after a clock rollback", () => {
    const state = startTimer(intervalInput({ cycles: 2 }), 0);
    const work = tickTimer(state, 15_000).state;
    const rollback = tickTimer(work, 5_000);

    expect(rollback.state).toMatchObject({
      status: "running",
      phase: { kind: "work", cycle: 1 },
      progress: 0,
      remainingSeconds: 20,
    });
    expect(rollback.transitions).toEqual([]);
  });

  it("cancels a running session without changing done", () => {
    const state = startTimer(countdownInput(), 0);
    expect(cancelTimer(state)).toBe(idleTimerState);

    const done = tickTimer(state, 60_000).state;
    expect(cancelTimer(done)).toBe(done);
  });
});

describe("createTimerEngine", () => {
  it("uses its injected clock", () => {
    let now = 10_000;
    const engine = createTimerEngine({ now: () => now });
    const started = engine.start(countdownInput());

    now = 10_500;
    const update = engine.tick(started);

    expect(update.state).toMatchObject({
      status: "running",
      progress: 0.5 / 60,
    });
  });
});
