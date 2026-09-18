import {
  createTimerEngine,
  idleTimerState,
  type DoneTimerState,
  type RunningTimerState,
  type TimerClock,
  type TimerEngine,
  type TimerOriginSnapshot,
  type TimerState,
  type TimerTransition,
} from "./engine";
import {
  createBrowserTimerAudio,
  type TimerAudioAdapter,
  type TimerAudioSignal,
} from "./audio";
import {
  validateRunnableTimerConfig,
  type TimerValidationIssue,
} from "./validation";

export interface TimerStartRequest {
  readonly config: unknown;
  readonly origin: TimerOriginSnapshot;
}

export type TimerStartResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: "invalid";
      readonly issues: readonly TimerValidationIssue[];
    }
  | {
      readonly ok: false;
      readonly reason: "occupied";
      readonly existing: RunningTimerState | DoneTimerState;
    };

export interface TimerSignal {
  readonly id: number;
  readonly kind: TimerAudioSignal;
  readonly transition: TimerTransition;
}

export interface TimerRuntimeSnapshot {
  readonly timer: TimerState;
  readonly focusOpen: boolean;
  readonly signal: TimerSignal | null;
}

export interface TimerStoreOptions {
  readonly audio?: TimerAudioAdapter;
  readonly clock?: TimerClock;
  readonly engine?: TimerEngine;
}

export interface TimerStore {
  getSnapshot(): TimerRuntimeSnapshot;
  getServerSnapshot(): TimerRuntimeSnapshot;
  subscribe(listener: () => void): () => void;
  start(request: TimerStartRequest): TimerStartResult;
  tick(): void;
  cancel(): boolean;
  dismiss(): boolean;
  openFocus(): boolean;
  closeFocus(): boolean;
}

const initialRuntimeSnapshot: TimerRuntimeSnapshot = Object.freeze({
  timer: idleTimerState,
  focusOpen: false,
  signal: null,
});

function audioSignalFor(transition: TimerTransition): TimerAudioSignal {
  return transition.type === "done" ? "done" : transition.to.kind;
}

export function createTimerStore(options: TimerStoreOptions = {}): TimerStore {
  const engine = options.engine ?? createTimerEngine(options.clock);
  const audio = options.audio ?? createBrowserTimerAudio();
  const listeners = new Set<() => void>();
  let snapshot = initialRuntimeSnapshot;
  let nextSignalId = 1;

  function publish(nextSnapshot: TimerRuntimeSnapshot): void {
    snapshot = Object.freeze(nextSnapshot);
    listeners.forEach((listener) => listener());
  }

  function safelyPrepareAudio(): void {
    try {
      audio.prepare();
    } catch {
      // Audio is an enhancement; timer state remains authoritative.
    }
  }

  function safelyPlayAudio(signal: TimerAudioSignal): void {
    try {
      audio.play(signal);
    } catch {
      // A blocked or unavailable audio context must not stop transitions.
    }
  }

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initialRuntimeSnapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start(request) {
      if (snapshot.timer.status !== "idle") {
        return {
          ok: false,
          reason: "occupied",
          existing: snapshot.timer,
        };
      }

      const validation = validateRunnableTimerConfig(request.config);

      if (!validation.success) {
        return {
          ok: false,
          reason: "invalid",
          issues: validation.issues,
        };
      }

      safelyPrepareAudio();
      const timer = engine.start({
        config: validation.data,
        origin: request.origin,
      });
      publish({ timer, focusOpen: true, signal: null });
      return { ok: true };
    },
    tick() {
      if (snapshot.timer.status !== "running") {
        return;
      }

      const update = engine.tick(snapshot.timer);
      const lastTransition = update.transitions.at(-1);
      let signal = snapshot.signal;

      if (lastTransition !== undefined) {
        const kind = audioSignalFor(lastTransition);
        signal = Object.freeze({
          id: nextSignalId,
          kind,
          transition: lastTransition,
        });
        nextSignalId += 1;
        safelyPlayAudio(kind);
      }

      publish({
        timer: update.state,
        focusOpen: snapshot.focusOpen,
        signal,
      });
    },
    cancel() {
      if (snapshot.timer.status !== "running") {
        return false;
      }

      publish(initialRuntimeSnapshot);
      return true;
    },
    dismiss() {
      if (snapshot.timer.status !== "done") {
        return false;
      }

      publish(initialRuntimeSnapshot);
      return true;
    },
    openFocus() {
      if (snapshot.timer.status === "idle" || snapshot.focusOpen) {
        return false;
      }

      publish({ ...snapshot, focusOpen: true, signal: null });
      return true;
    },
    closeFocus() {
      if (snapshot.timer.status === "idle" || !snapshot.focusOpen) {
        return false;
      }

      publish({ ...snapshot, focusOpen: false, signal: null });
      return true;
    },
  };
}

export const timerStore = createTimerStore();
