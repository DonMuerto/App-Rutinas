"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  timerStore,
  type TimerRuntimeSnapshot,
  type TimerStartRequest,
  type TimerStartResult,
  type TimerStore,
} from "@/lib/timer";

import { TimerDock } from "./timer-dock";
import { TimerOverlay } from "./timer-overlay";

const TimerStoreContext = createContext<TimerStore | null>(null);

export interface TimerController extends TimerRuntimeSnapshot {
  start(request: TimerStartRequest): TimerStartResult;
  cancel(): boolean;
  dismiss(): boolean;
  openFocus(): boolean;
  closeFocus(): boolean;
}

export interface TimerProviderProps {
  readonly children: ReactNode;
  readonly store?: TimerStore;
}

function useTimerSnapshot(store: TimerStore): TimerRuntimeSnapshot {
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
}

export function TimerProvider({
  children,
  store = timerStore,
}: TimerProviderProps) {
  const snapshot = useTimerSnapshot(store);
  const [restoreFocusToDock, setRestoreFocusToDock] = useState(false);

  useEffect(() => {
    if (snapshot.timer.status !== "running") {
      return;
    }

    const tick = () => store.tick();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        tick();
      }
    };
    const intervalId = window.setInterval(tick, 250);

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [snapshot.timer.status, store]);

  const occupiedTimer =
    snapshot.timer.status === "idle" ? null : snapshot.timer;

  return (
    <TimerStoreContext value={store}>
      {children}
      {occupiedTimer !== null && snapshot.focusOpen ? (
        <TimerOverlay
          onCancel={() => {
            setRestoreFocusToDock(false);
            store.cancel();
          }}
          onClose={store.closeFocus}
          onDismiss={() => {
            setRestoreFocusToDock(false);
            store.dismiss();
          }}
          signal={snapshot.signal}
          timer={occupiedTimer}
        />
      ) : null}
      {occupiedTimer !== null && !snapshot.focusOpen ? (
        <TimerDock
          onOpen={() => {
            setRestoreFocusToDock(true);
            store.openFocus();
          }}
          onFocusRestored={() => setRestoreFocusToDock(false)}
          restoreFocus={restoreFocusToDock}
          signal={snapshot.signal}
          timer={occupiedTimer}
        />
      ) : null}
    </TimerStoreContext>
  );
}

export function useTimer(): TimerController {
  const store = useContext(TimerStoreContext);

  if (store === null) {
    throw new Error("useTimer debe usarse dentro de TimerProvider.");
  }

  const snapshot = useTimerSnapshot(store);

  return {
    ...snapshot,
    start: store.start,
    cancel: store.cancel,
    dismiss: store.dismiss,
    openFocus: store.openFocus,
    closeFocus: store.closeFocus,
  };
}
