import type {
  LifecycleDisposition,
  LifecycleEventType,
  LifecycleListener,
  LifecyclePort,
} from "./types";

export interface LifecycleController extends LifecyclePort {
  emit(event: LifecycleEventType): Promise<LifecycleDisposition>;
  clear(): void;
}

export function createLifecycleController(): LifecycleController {
  const listeners = new Map<LifecycleListener, number>();

  return {
    subscribe(listener, options) {
      listeners.set(listener, options?.priority ?? 0);
      return () => listeners.delete(listener);
    },
    async emit(event) {
      const ordered = [...listeners].sort((left, right) => right[1] - left[1]);
      for (const [listener] of ordered) {
        if ((await listener(event)) === "handled") return "handled";
      }
      return "continue";
    },
    clear() {
      listeners.clear();
    },
  };
}
