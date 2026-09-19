import type {
  AudioPort,
  LifecycleEventType,
  LifecyclePort,
  TimerStoragePort,
} from "@ritmo/platform";

import {
  createTimerEngine,
  idleTimerState,
  systemTimerClock,
  type DoneTimerState,
  type RunningTimerState,
  type TimerClock,
  type TimerOriginSnapshot,
  type TimerState,
  type TimerTransition,
} from "./engine";
import {
  deserializeTimerSnapshot,
  restoreTimerSnapshot,
  serializeTimerSnapshot,
  type TimerRestoreResult,
} from "./snapshot";
import {
  validateRunnableTimerConfig,
  type TimerValidationIssue,
} from "./validation";

export type TimerSignalKind = "phase" | "done";

export interface TimerSignal {
  readonly id: number;
  readonly kind: TimerSignalKind;
  readonly transition: TimerTransition;
}

export type TimerLifecycleState = "active" | "background";

export interface TimerControllerSnapshot {
  readonly timer: TimerState;
  readonly focusOpen: boolean;
  readonly signal: TimerSignal | null;
  readonly lifecycle: TimerLifecycleState;
  readonly restoring: boolean;
  readonly persistenceError: string | null;
}

export interface TimerStartRequest {
  readonly config: unknown;
  readonly origin: TimerOriginSnapshot;
}

export type TimerStartResult =
  | { readonly ok: true; readonly state: RunningTimerState }
  | {
      readonly ok: false;
      readonly reason: "invalid";
      readonly issues: readonly TimerValidationIssue[];
    }
  | {
      readonly ok: false;
      readonly reason: "occupied";
      readonly existing: RunningTimerState | DoneTimerState;
    }
  | {
      readonly ok: false;
      readonly reason: "storage-error";
      readonly error: unknown;
    }
  | { readonly ok: false; readonly reason: "logged-out" };

export type TimerTickResult =
  | {
      readonly changed: boolean;
      readonly state: TimerState;
      readonly transitions: readonly TimerTransition[];
    }
  | {
      readonly changed: false;
      readonly state: TimerState;
      readonly transitions: readonly [];
    };

export type TimerRestoreOutcome =
  | TimerRestoreResult
  | { readonly status: "storage-error"; readonly error: unknown };

export interface TimerControllerOptions {
  readonly userId: string;
  readonly contextId: string;
  readonly lifecycle: LifecyclePort;
  readonly timerStorage: TimerStoragePort;
  readonly audio: AudioPort;
  readonly clock?: TimerClock;
}

export interface TimerController {
  readonly ready: Promise<TimerRestoreOutcome>;
  getSnapshot(): TimerControllerSnapshot;
  getServerSnapshot(): TimerControllerSnapshot;
  subscribe(listener: () => void): () => void;
  start(request: TimerStartRequest): Promise<TimerStartResult>;
  tick(): Promise<TimerTickResult>;
  restore(): Promise<TimerRestoreOutcome>;
  cancel(): Promise<boolean>;
  dismiss(): Promise<boolean>;
  logout(): Promise<void>;
  openFocus(): boolean;
  closeFocus(): boolean;
  dispose(): void;
}

const initialSnapshot: TimerControllerSnapshot = Object.freeze({
  timer: idleTimerState,
  focusOpen: false,
  signal: null,
  lifecycle: "active",
  restoring: true,
  persistenceError: null,
});

function isOccupied(
  timer: TimerState,
): timer is RunningTimerState | DoneTimerState {
  return timer.status !== "idle";
}

function toAudioSignal(transition: TimerTransition): TimerSignalKind {
  return transition.type === "done" ? "done" : "phase";
}

export function createTimerController(
  options: TimerControllerOptions,
): TimerController {
  if (options.userId.trim() === "" || options.contextId.trim() === "") {
    throw new Error("Timer controller requires userId and contextId.");
  }

  const clock = options.clock ?? systemTimerClock;
  const engine = createTimerEngine(clock);
  const identity = {
    userId: options.userId,
    contextId: options.contextId,
  } as const;
  const listeners = new Set<() => void>();
  let snapshot = initialSnapshot;
  let nextSignalId = 1;
  let loggedOut = false;
  let disposed = false;
  let restoreFailure: unknown;
  let restoreFailed = false;
  let queue = Promise.resolve();

  function publish(next: TimerControllerSnapshot): void {
    snapshot = Object.freeze(next);
    listeners.forEach((listener) => listener());
  }

  function enqueue<T>(operation: () => Promise<T> | T): Promise<T> {
    const next = queue.then(operation);
    queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  async function playSignal(transition: TimerTransition): Promise<void> {
    try {
      await options.audio.play(toAudioSignal(transition));
    } catch {
      // Audio is optional and never changes timer truth.
    }
  }

  async function persist(
    timer: Exclude<TimerState, { status: "idle" }>,
  ): Promise<void> {
    await options.timerStorage.set(
      serializeTimerSnapshot(timer, identity, clock.now()),
    );
  }

  async function removePersisted(): Promise<void> {
    await options.timerStorage.remove(identity.userId, identity.contextId);
  }

  async function clearUserPersisted(): Promise<void> {
    await options.timerStorage.clearUser(identity.userId);
  }

  async function reconcileCurrent(): Promise<TimerTickResult> {
    if (snapshot.timer.status !== "running") {
      return { changed: false, state: snapshot.timer, transitions: [] };
    }

    const update = engine.tick(snapshot.timer);
    if (update.transitions.length === 0) {
      if (update.state !== snapshot.timer) {
        publish({ ...snapshot, timer: update.state });
      }
      return {
        changed: update.state !== snapshot.timer,
        state: update.state,
        transitions: [],
      };
    }

    publish({ ...snapshot, timer: update.state, persistenceError: null });
    const lastTransition = update.transitions.at(-1);
    if (lastTransition !== undefined) {
      const signal = Object.freeze({
        id: nextSignalId,
        kind: toAudioSignal(lastTransition),
        transition: lastTransition,
      });
      nextSignalId += 1;
      publish({ ...snapshot, timer: update.state, signal });
      void playSignal(lastTransition);
    }

    try {
      if (update.state.status === "idle") {
        await removePersisted();
      } else {
        await persist(update.state);
      }
      publish({ ...snapshot, persistenceError: null });
    } catch {
      publish({
        ...snapshot,
        persistenceError: "No se pudo guardar el timer.",
      });
    }

    return {
      changed: true,
      state: update.state,
      transitions: update.transitions,
    };
  }

  async function restoreFromStorage(): Promise<TimerRestoreOutcome> {
    try {
      const envelope = await options.timerStorage.get(
        identity.userId,
        identity.contextId,
      );
      restoreFailed = false;
      restoreFailure = undefined;

      if (envelope === null) {
        publish({ ...snapshot, restoring: false, persistenceError: null });
        return { status: "empty" };
      }

      const parsed = deserializeTimerSnapshot(envelope, identity);
      if (!parsed.success) {
        await removePersisted();
        publish({
          ...snapshot,
          timer: idleTimerState,
          focusOpen: false,
          signal: null,
          restoring: false,
          persistenceError: null,
        });
        return { status: "discarded", reason: parsed.reason };
      }

      const restored = restoreTimerSnapshot(parsed.snapshot, clock.now());
      if (restored.status === "empty") {
        publish({ ...snapshot, restoring: false, persistenceError: null });
        return restored;
      }
      if (restored.status === "discarded") {
        await removePersisted();
        publish({
          ...snapshot,
          timer: idleTimerState,
          focusOpen: false,
          signal: null,
          restoring: false,
          persistenceError: null,
        });
        return restored;
      }

      publish({
        ...snapshot,
        timer: restored.state,
        focusOpen: true,
        signal: null,
        restoring: false,
        persistenceError: null,
      });

      if (restored.transitions.length > 0) {
        const lastTransition = restored.transitions.at(-1);
        if (lastTransition !== undefined) {
          const signal = Object.freeze({
            id: nextSignalId,
            kind: toAudioSignal(lastTransition),
            transition: lastTransition,
          });
          nextSignalId += 1;
          publish({ ...snapshot, signal });
          void playSignal(lastTransition);
        }
        await persist(restored.state);
      }

      return restored;
    } catch (error) {
      restoreFailed = true;
      restoreFailure = error;
      publish({
        ...snapshot,
        restoring: false,
        persistenceError: "No se pudo restaurar el timer.",
      });
      return { status: "storage-error", error };
    }
  }

  async function onLifecycle(event: LifecycleEventType): Promise<void> {
    if (disposed || loggedOut) {
      return;
    }

    if (event === "background") {
      publish({ ...snapshot, lifecycle: "background" });
      return;
    }

    if (event === "active") {
      publish({ ...snapshot, lifecycle: "active" });
      return;
    }

    if (event === "resume") {
      publish({ ...snapshot, lifecycle: "active" });
      await reconcileCurrent();
    }
  }

  const unsubscribeLifecycle = options.lifecycle.subscribe((event) =>
    enqueue(async () => {
      await onLifecycle(event);
      return "continue" as const;
    }),
  );
  const ready = enqueue(restoreFromStorage);

  const controller: TimerController = {
    ready,
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initialSnapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start(request) {
      return enqueue(async () => {
        if (loggedOut) {
          return { ok: false, reason: "logged-out" };
        }
        if (restoreFailed) {
          return {
            ok: false,
            reason: "storage-error",
            error: restoreFailure,
          };
        }

        if (isOccupied(snapshot.timer)) {
          return { ok: false, reason: "occupied", existing: snapshot.timer };
        }

        const validation = validateRunnableTimerConfig(request.config);
        if (!validation.success) {
          return { ok: false, reason: "invalid", issues: validation.issues };
        }

        try {
          await options.audio.prepare();
        } catch {
          // The AudioPort can be blocked; Start remains usable with visual cues.
        }

        const timer = engine.start({
          config: validation.data,
          origin: request.origin,
        });

        try {
          await persist(timer);
        } catch (error) {
          publish({
            ...snapshot,
            persistenceError: "No se pudo guardar el timer.",
          });
          return { ok: false, reason: "storage-error", error };
        }

        publish({
          ...snapshot,
          timer,
          focusOpen: true,
          signal: null,
          restoring: false,
          persistenceError: null,
        });
        return { ok: true, state: timer };
      });
    },
    tick() {
      return enqueue(reconcileCurrent);
    },
    restore() {
      return enqueue(async () => {
        if (loggedOut) {
          return { status: "empty" };
        }
        if (snapshot.timer.status !== "idle") {
          return {
            status: "reconciled",
            state: snapshot.timer,
            transitions: [] as const,
          };
        }
        return restoreFromStorage();
      });
    },
    cancel() {
      return enqueue(async () => {
        if (snapshot.timer.status !== "running") {
          return false;
        }
        await removePersisted();
        publish({
          ...snapshot,
          timer: idleTimerState,
          focusOpen: false,
          signal: null,
          persistenceError: null,
        });
        return true;
      });
    },
    dismiss() {
      return enqueue(async () => {
        if (snapshot.timer.status !== "done") {
          return false;
        }
        await removePersisted();
        publish({
          ...snapshot,
          timer: idleTimerState,
          focusOpen: false,
          signal: null,
          persistenceError: null,
        });
        return true;
      });
    },
    logout() {
      return enqueue(async () => {
        loggedOut = true;
        try {
          await clearUserPersisted();
        } finally {
          publish({
            ...snapshot,
            timer: idleTimerState,
            focusOpen: false,
            signal: null,
            restoring: false,
            persistenceError: null,
          });
        }
      });
    },
    openFocus() {
      if (!isOccupied(snapshot.timer) || snapshot.focusOpen) {
        return false;
      }
      publish({ ...snapshot, focusOpen: true, signal: null });
      return true;
    },
    closeFocus() {
      if (!isOccupied(snapshot.timer) || !snapshot.focusOpen) {
        return false;
      }
      publish({ ...snapshot, focusOpen: false, signal: null });
      return true;
    },
    dispose() {
      disposed = true;
      unsubscribeLifecycle();
      listeners.clear();
    },
  };

  return controller;
}
