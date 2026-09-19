import type { JsonValue } from "@ritmo/core";
import type { TimerSnapshotEnvelope } from "@ritmo/platform";

import {
  buildTimerPlan,
  startTimer,
  tickTimer,
  type TimerOriginSnapshot,
  type TimerPhase,
  type TimerPlan,
  type TimerState,
} from "./engine";
import {
  validateRunnableTimerConfig,
  type RunnableTimerConfig,
} from "./validation";

export const TIMER_SNAPSHOT_VERSION = 1 as const;

export interface TimerSnapshotIdentity {
  readonly userId: string;
  readonly contextId: string;
}

export interface TimerSnapshotPayload {
  readonly version: typeof TIMER_SNAPSHOT_VERSION;
  readonly userId: string;
  readonly contextId: string;
  readonly status: "running" | "done";
  readonly config: RunnableTimerConfig;
  readonly origin: TimerOriginSnapshot;
  readonly plan: TimerPlan;
  readonly startedAt: number;
  readonly phaseIndex: number | null;
  readonly phaseStartedAt: number | null;
  readonly deadline: number | null;
  readonly completedAt: number | null;
}

export type TimerSnapshotParseResult =
  | {
      readonly success: true;
      readonly snapshot: TimerSnapshotPayload;
    }
  | {
      readonly success: false;
      readonly reason: "invalid" | "user-mismatch" | "context-mismatch";
    };

export type TimerRestoreResult =
  | { readonly status: "empty" }
  | {
      readonly status: "restored";
      readonly state: Exclude<TimerState, { status: "idle" }>;
      readonly transitions: readonly [];
    }
  | {
      readonly status: "reconciled";
      readonly state: Exclude<TimerState, { status: "idle" }>;
      readonly transitions: ReturnType<typeof tickTimer>["transitions"];
    }
  | {
      readonly status: "discarded";
      readonly reason: "invalid" | "user-mismatch" | "context-mismatch";
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value);
}

function isPositiveInteger(value: unknown): value is number {
  return isInteger(value) && value > 0;
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isNullableInteger(value: unknown): value is number | null {
  return value === null || isInteger(value);
}

function isPhaseKind(value: unknown): value is TimerPhase["kind"] {
  return (
    value === "prepare" ||
    value === "work" ||
    value === "cycle-rest" ||
    value === "set-rest"
  );
}

function isOrigin(value: unknown): value is TimerOriginSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value.activityId) &&
    isString(value.activityTitle) &&
    isString(value.routineId) &&
    isString(value.routineName)
  );
}

function isPhase(value: unknown): value is TimerPhase {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value.id) &&
    isPhaseKind(value.kind) &&
    isPositiveInteger(value.durationSeconds) &&
    (value.cycle === undefined || isPositiveInteger(value.cycle)) &&
    (value.set === undefined || isPositiveInteger(value.set))
  );
}

function isPlan(value: unknown): value is TimerPlan {
  if (!isRecord(value) || !Array.isArray(value.phases)) {
    return false;
  }

  return (
    (value.mode === "countdown" || value.mode === "interval") &&
    value.phases.every(isPhase) &&
    value.phases.length > 0 &&
    isPositiveInteger(value.totalDurationSeconds) &&
    (value.cycles === undefined || isPositiveInteger(value.cycles)) &&
    (value.sets === undefined || isPositiveInteger(value.sets))
  );
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isEnvelope(value: unknown): value is TimerSnapshotEnvelope {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.version === TIMER_SNAPSHOT_VERSION &&
    isString(value.userId) &&
    isString(value.contextId) &&
    isFiniteNumber(value.updatedAt)
  );
}

function parsePayload(
  value: unknown,
  identity: TimerSnapshotIdentity,
): TimerSnapshotParseResult {
  if (!isRecord(value)) {
    return { success: false, reason: "invalid" };
  }

  if (!isString(value.userId) || !isString(value.contextId)) {
    return { success: false, reason: "invalid" };
  }

  if (value.userId !== identity.userId) {
    return { success: false, reason: "user-mismatch" };
  }

  if (value.contextId !== identity.contextId) {
    return { success: false, reason: "context-mismatch" };
  }

  if (
    value.version !== TIMER_SNAPSHOT_VERSION ||
    (value.status !== "running" && value.status !== "done") ||
    !isFiniteNumber(value.startedAt) ||
    !isOrigin(value.origin) ||
    !isPlan(value.plan) ||
    !isNullableInteger(value.phaseIndex) ||
    !isNullableFiniteNumber(value.phaseStartedAt) ||
    !isNullableFiniteNumber(value.deadline) ||
    !isNullableFiniteNumber(value.completedAt)
  ) {
    return { success: false, reason: "invalid" };
  }

  const configResult = validateRunnableTimerConfig(value.config);
  if (!configResult.success) {
    return { success: false, reason: "invalid" };
  }

  const expectedPlan = buildTimerPlan(configResult.data);
  if (!sameJson(value.plan, expectedPlan)) {
    return { success: false, reason: "invalid" };
  }

  if (value.plan.mode !== configResult.data.timerType) {
    return { success: false, reason: "invalid" };
  }

  if (value.status === "running") {
    if (
      value.phaseIndex === null ||
      value.phaseStartedAt === null ||
      value.deadline === null ||
      value.completedAt !== null ||
      value.phaseIndex < 0 ||
      value.phaseIndex >= value.plan.phases.length
    ) {
      return { success: false, reason: "invalid" };
    }

    const phase = value.plan.phases[value.phaseIndex];
    const expectedPhaseStartedAt =
      value.startedAt +
      value.plan.phases
        .slice(0, value.phaseIndex)
        .reduce(
          (total, candidate) => total + candidate.durationSeconds * 1_000,
          0,
        );

    if (
      value.phaseStartedAt !== expectedPhaseStartedAt ||
      value.deadline !== expectedPhaseStartedAt + phase.durationSeconds * 1_000
    ) {
      return { success: false, reason: "invalid" };
    }
  } else if (
    value.phaseIndex !== null ||
    value.phaseStartedAt !== null ||
    value.deadline !== null ||
    value.completedAt !==
      value.startedAt + value.plan.totalDurationSeconds * 1_000
  ) {
    return { success: false, reason: "invalid" };
  }

  return {
    success: true,
    snapshot: {
      version: TIMER_SNAPSHOT_VERSION,
      userId: value.userId,
      contextId: value.contextId,
      status: value.status,
      config: configResult.data,
      origin: value.origin,
      plan: value.plan,
      startedAt: value.startedAt,
      phaseIndex: value.phaseIndex,
      phaseStartedAt: value.phaseStartedAt,
      deadline: value.deadline,
      completedAt: value.completedAt,
    },
  };
}

export function serializeTimerSnapshot(
  state: Exclude<TimerState, { status: "idle" }>,
  identity: TimerSnapshotIdentity,
  updatedAt: number,
): TimerSnapshotEnvelope {
  if (!isFiniteNumber(updatedAt)) {
    throw new RangeError("El timestamp del snapshot debe ser finito.");
  }

  const payload: TimerSnapshotPayload = {
    version: TIMER_SNAPSHOT_VERSION,
    userId: identity.userId,
    contextId: identity.contextId,
    status: state.status,
    config: state.config,
    origin: state.origin,
    plan: state.plan,
    startedAt: state.startedAt,
    phaseIndex: state.status === "running" ? state.phaseIndex : null,
    phaseStartedAt: state.status === "running" ? state.phaseStartedAt : null,
    deadline: state.status === "running" ? state.deadline : null,
    completedAt: state.status === "done" ? state.completedAt : null,
  };

  return {
    version: TIMER_SNAPSHOT_VERSION,
    userId: identity.userId,
    contextId: identity.contextId,
    payload: payload as unknown as JsonValue,
    updatedAt,
  };
}

export function deserializeTimerSnapshot(
  envelope: unknown,
  identity: TimerSnapshotIdentity,
): TimerSnapshotParseResult {
  if (!isEnvelope(envelope)) {
    return { success: false, reason: "invalid" };
  }

  if (envelope.userId !== identity.userId) {
    return { success: false, reason: "user-mismatch" };
  }

  if (envelope.contextId !== identity.contextId) {
    return { success: false, reason: "context-mismatch" };
  }

  return parsePayload(envelope.payload, identity);
}

export function restoreTimerSnapshot(
  snapshot: TimerSnapshotPayload,
  now: number,
): TimerRestoreResult {
  if (!isFiniteNumber(now)) {
    throw new RangeError("El timestamp de restauracion debe ser finito.");
  }

  const initial = startTimer(
    { config: snapshot.config, origin: snapshot.origin },
    snapshot.startedAt,
  );

  if (snapshot.status === "done") {
    const done = tickTimer(
      initial,
      snapshot.startedAt + initial.plan.totalDurationSeconds * 1_000,
    );
    if (done.state.status !== "done") {
      return { status: "discarded", reason: "invalid" };
    }
    return { status: "restored", state: done.state, transitions: [] };
  }

  const reconciled = tickTimer(initial, now);
  if (reconciled.state.status === "idle") {
    return { status: "discarded", reason: "invalid" };
  }

  return reconciled.transitions.length > 0
    ? {
        status: "reconciled",
        state: reconciled.state,
        transitions: reconciled.transitions,
      }
    : { status: "restored", state: reconciled.state, transitions: [] };
}
