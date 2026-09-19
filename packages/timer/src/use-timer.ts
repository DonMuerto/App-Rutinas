import { useContext, useSyncExternalStore } from "react";

import type {
  TimerControllerSnapshot,
  TimerRestoreOutcome,
  TimerStartRequest,
  TimerStartResult,
  TimerTickResult,
} from "./controller";
import { TimerControllerContext } from "./context";

export interface TimerControllerView extends TimerControllerSnapshot {
  start(request: TimerStartRequest): Promise<TimerStartResult>;
  tick(): Promise<TimerTickResult>;
  restore(): Promise<TimerRestoreOutcome>;
  cancel(): Promise<boolean>;
  dismiss(): Promise<boolean>;
  logout(): Promise<void>;
  openFocus(): boolean;
  closeFocus(): boolean;
}

export function useTimer(): TimerControllerView {
  const controller = useContext(TimerControllerContext);

  if (controller === null) {
    throw new Error("useTimer debe usarse dentro de TimerProvider.");
  }

  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getServerSnapshot,
  );

  return {
    ...snapshot,
    start: controller.start,
    tick: controller.tick,
    restore: controller.restore,
    cancel: controller.cancel,
    dismiss: controller.dismiss,
    logout: controller.logout,
    openFocus: controller.openFocus,
    closeFocus: controller.closeFocus,
  };
}
