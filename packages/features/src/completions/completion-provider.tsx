import { use, useSyncExternalStore } from "react";
import type { LocalDate } from "@ritmo/core";

import { CompletionContext } from "./completion-context";
import type { CompletionState, CompletionTarget } from "./completion-store";

const SERVER_STATE: CompletionState = Object.freeze({
  completed: false,
  pending: false,
});

export function useCompletionStore() {
  const store = use(CompletionContext);
  if (!store)
    throw new Error("useCompletionStore requiere CompletionProvider.");
  return store;
}

export function useCompletionState(
  userId: string,
  target: CompletionTarget,
  date: LocalDate,
) {
  const store = useCompletionStore();
  return useSyncExternalStore(
    store.subscribe,
    () => store.getState(userId, target, date),
    () => SERVER_STATE,
  );
}

export function useCompletionAnnouncement(userId: string) {
  const store = useCompletionStore();
  return useSyncExternalStore(
    store.subscribe,
    () => store.getAnnouncement(userId),
    () => "",
  );
}
