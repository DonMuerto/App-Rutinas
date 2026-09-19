import {
  parseRunnableTimerConfig,
  type RunnableTimerConfig,
} from "./validation";

export type TimerMode = RunnableTimerConfig["timerType"];

export type TimerPhaseKind = "prepare" | "work" | "cycle-rest" | "set-rest";

export interface TimerPhase {
  readonly id: string;
  readonly kind: TimerPhaseKind;
  readonly durationSeconds: number;
  readonly cycle?: number;
  readonly set?: number;
}

export interface TimerPlan {
  readonly mode: TimerMode;
  readonly phases: readonly TimerPhase[];
  readonly totalDurationSeconds: number;
  readonly cycles?: number;
  readonly sets?: number;
}

export interface TimerOriginSnapshot {
  readonly activityId: string;
  readonly activityTitle: string;
  readonly routineId: string;
  readonly routineName: string;
}

export interface TimerStartInput {
  readonly config: unknown;
  readonly origin: TimerOriginSnapshot;
}

export interface IdleTimerState {
  readonly status: "idle";
}

interface OccupiedTimerState {
  readonly mode: TimerMode;
  readonly origin: TimerOriginSnapshot;
  readonly config: RunnableTimerConfig;
  readonly plan: TimerPlan;
  readonly startedAt: number;
}

export interface RunningTimerState extends OccupiedTimerState {
  readonly status: "running";
  readonly phase: TimerPhase;
  readonly phaseIndex: number;
  readonly phaseStartedAt: number;
  readonly deadline: number;
  readonly phaseDurationSeconds: number;
  readonly remainingSeconds: number;
  readonly progress: number;
}

export interface DoneTimerState extends OccupiedTimerState {
  readonly status: "done";
  readonly completedAt: number;
}

export type TimerState = IdleTimerState | RunningTimerState | DoneTimerState;

export type TimerTransition =
  | {
      readonly type: "phase-changed";
      readonly at: number;
      readonly from: TimerPhase;
      readonly to: TimerPhase;
    }
  | {
      readonly type: "done";
      readonly at: number;
      readonly from: TimerPhase;
    };

export interface TimerUpdate {
  readonly state: TimerState;
  readonly transitions: readonly TimerTransition[];
}

export interface TimerClock {
  now(): number;
}

export interface TimerEngine {
  start(input: TimerStartInput): RunningTimerState;
  tick(state: TimerState): TimerUpdate;
  cancel(state: TimerState): TimerState;
}

export const idleTimerState: IdleTimerState = Object.freeze({ status: "idle" });

export const systemTimerClock: TimerClock = {
  now: () => Date.now(),
};

function freezePhase(phase: TimerPhase): TimerPhase {
  return Object.freeze(phase);
}

export function buildTimerPlan(input: unknown): TimerPlan {
  const config = parseRunnableTimerConfig(input);
  const phases: TimerPhase[] = [];

  if (config.timerType === "countdown") {
    phases.push(
      freezePhase({
        id: "work",
        kind: "work",
        durationSeconds: config.countdownSeconds,
      }),
    );
  } else {
    if (config.prepareSeconds > 0) {
      phases.push(
        freezePhase({
          id: "prepare",
          kind: "prepare",
          durationSeconds: config.prepareSeconds,
        }),
      );
    }

    for (let set = 1; set <= config.sets; set += 1) {
      for (let cycle = 1; cycle <= config.cycles; cycle += 1) {
        phases.push(
          freezePhase({
            id: `work-s${set}-c${cycle}`,
            kind: "work",
            durationSeconds: config.workSeconds,
            cycle,
            set,
          }),
        );

        if (cycle < config.cycles && config.restSeconds > 0) {
          phases.push(
            freezePhase({
              id: `cycle-rest-s${set}-c${cycle}`,
              kind: "cycle-rest",
              durationSeconds: config.restSeconds,
              cycle,
              set,
            }),
          );
        }
      }

      if (set < config.sets && config.restBetweenSetsSeconds > 0) {
        phases.push(
          freezePhase({
            id: `set-rest-s${set}`,
            kind: "set-rest",
            durationSeconds: config.restBetweenSetsSeconds,
            set,
          }),
        );
      }
    }
  }

  const totalDurationSeconds = phases.reduce(
    (total, phase) => total + phase.durationSeconds,
    0,
  );

  return Object.freeze({
    mode: config.timerType,
    phases: Object.freeze(phases),
    totalDurationSeconds,
    ...(config.timerType === "interval"
      ? { cycles: config.cycles, sets: config.sets }
      : {}),
  });
}

function assertTimestamp(timestamp: number): void {
  if (!Number.isFinite(timestamp)) {
    throw new RangeError("El timestamp del temporizador debe ser finito.");
  }
}

function phaseStartAt(
  plan: TimerPlan,
  startedAt: number,
  phaseIndex: number,
): number {
  let elapsedSeconds = 0;

  for (let index = 0; index < phaseIndex; index += 1) {
    elapsedSeconds += plan.phases[index].durationSeconds;
  }

  return startedAt + elapsedSeconds * 1_000;
}

function runningStateAt(
  base: OccupiedTimerState,
  phaseIndex: number,
  now: number,
): RunningTimerState {
  const phase = base.plan.phases[phaseIndex];
  const phaseStartedAt = phaseStartAt(base.plan, base.startedAt, phaseIndex);
  const durationMilliseconds = phase.durationSeconds * 1_000;
  const deadline = phaseStartedAt + durationMilliseconds;
  const elapsedMilliseconds = Math.min(
    durationMilliseconds,
    Math.max(0, now - phaseStartedAt),
  );

  return Object.freeze({
    ...base,
    status: "running",
    phase,
    phaseIndex,
    phaseStartedAt,
    deadline,
    phaseDurationSeconds: phase.durationSeconds,
    remainingSeconds: Math.min(
      phase.durationSeconds,
      Math.max(0, Math.ceil((deadline - now) / 1_000)),
    ),
    progress: Math.min(
      1,
      Math.max(0, elapsedMilliseconds / durationMilliseconds),
    ),
  });
}

export function startTimer(
  input: TimerStartInput,
  startedAt: number,
): RunningTimerState {
  assertTimestamp(startedAt);

  const config = parseRunnableTimerConfig(input.config);
  const plan = buildTimerPlan(config);
  const origin = Object.freeze({ ...input.origin });
  const base: OccupiedTimerState = Object.freeze({
    mode: plan.mode,
    origin,
    config,
    plan,
    startedAt,
  });

  return runningStateAt(base, 0, startedAt);
}

function getPhaseIndexAt(
  plan: TimerPlan,
  startedAt: number,
  now: number,
): number {
  let deadline = startedAt;

  for (let index = 0; index < plan.phases.length; index += 1) {
    deadline += plan.phases[index].durationSeconds * 1_000;

    if (now < deadline) {
      return index;
    }
  }

  return plan.phases.length;
}

function buildTransitions(
  state: RunningTimerState,
  nextPhaseIndex: number,
): readonly TimerTransition[] {
  const transitions: TimerTransition[] = [];
  let from = state.phase;

  for (
    let phaseIndex = state.phaseIndex + 1;
    phaseIndex < nextPhaseIndex;
    phaseIndex += 1
  ) {
    const to = state.plan.phases[phaseIndex];
    transitions.push(
      Object.freeze({
        type: "phase-changed",
        at: phaseStartAt(state.plan, state.startedAt, phaseIndex),
        from,
        to,
      }),
    );
    from = to;
  }

  if (nextPhaseIndex < state.plan.phases.length) {
    const to = state.plan.phases[nextPhaseIndex];
    transitions.push(
      Object.freeze({
        type: "phase-changed",
        at: phaseStartAt(state.plan, state.startedAt, nextPhaseIndex),
        from,
        to,
      }),
    );
  } else {
    transitions.push(
      Object.freeze({
        type: "done",
        at: state.startedAt + state.plan.totalDurationSeconds * 1_000,
        from,
      }),
    );
  }

  return Object.freeze(transitions);
}

export function tickTimer(state: TimerState, now: number): TimerUpdate {
  assertTimestamp(now);

  if (state.status !== "running") {
    return { state, transitions: [] };
  }

  const nextPhaseIndex = Math.max(
    state.phaseIndex,
    getPhaseIndexAt(state.plan, state.startedAt, now),
  );

  if (nextPhaseIndex === state.phaseIndex) {
    return {
      state: runningStateAt(state, state.phaseIndex, now),
      transitions: [],
    };
  }

  const transitions = buildTransitions(state, nextPhaseIndex);

  if (nextPhaseIndex === state.plan.phases.length) {
    return {
      state: Object.freeze({
        status: "done",
        mode: state.mode,
        origin: state.origin,
        config: state.config,
        plan: state.plan,
        startedAt: state.startedAt,
        completedAt: state.startedAt + state.plan.totalDurationSeconds * 1_000,
      }),
      transitions,
    };
  }

  return {
    state: runningStateAt(state, nextPhaseIndex, now),
    transitions,
  };
}

export function cancelTimer(state: TimerState): TimerState {
  return state.status === "running" ? idleTimerState : state;
}

export function createTimerEngine(
  clock: TimerClock = systemTimerClock,
): TimerEngine {
  return {
    start: (input) => startTimer(input, clock.now()),
    tick: (state) => tickTimer(state, clock.now()),
    cancel: cancelTimer,
  };
}
