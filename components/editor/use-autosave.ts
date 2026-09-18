"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { AutosaveController } from "./autosave";

export function useAutosave<Value>(
  save: (value: Value) => Promise<void>,
  delay = 750,
) {
  const [controller] = useState(() => new AutosaveController(save, delay));

  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );

  useEffect(
    () => () => {
      if (controller.getSnapshot().hasUnsavedChanges) {
        void controller
          .flush()
          .catch(() => undefined)
          .finally(() => controller.dispose());
      } else {
        controller.dispose();
      }
    },
    [controller],
  );

  useEffect(() => controller.setSave(save), [controller, save]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!controller.getSnapshot().hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [controller]);

  return { controller, snapshot };
}
