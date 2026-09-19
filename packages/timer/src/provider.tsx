import { useEffect, useSyncExternalStore, type PropsWithChildren } from "react";

import type { TimerController } from "./controller";
import { TimerControllerContext } from "./context";
import { TimerSurface } from "./timer-surface";

export interface TimerProviderProps extends PropsWithChildren {
  readonly controller: TimerController;
}

export function TimerProvider({ children, controller }: TimerProviderProps) {
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getServerSnapshot,
  );

  useEffect(() => {
    if (
      snapshot.timer.status !== "running" ||
      snapshot.lifecycle !== "active"
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      void controller.tick();
    }, 250);

    return () => window.clearInterval(interval);
  }, [controller, snapshot.lifecycle, snapshot.timer.status]);

  return (
    <TimerControllerContext value={controller}>
      {children}
      <TimerSurface />
    </TimerControllerContext>
  );
}
