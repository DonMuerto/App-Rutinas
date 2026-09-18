"use client";

import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import type { LocalDate } from "@/lib/contracts";

import type {
  CompletionState,
  CompletionTarget,
  DailyCompletionCache,
} from "./types";

const SERVER_COMPLETION_STATE: CompletionState = Object.freeze({
  completed: false,
  pending: false,
});

const CompletionCacheContext = createContext<DailyCompletionCache | null>(null);

export function CompletionProvider({
  cache,
  children,
}: {
  cache: DailyCompletionCache;
  children: ReactNode;
}) {
  return (
    <CompletionCacheContext value={cache}>{children}</CompletionCacheContext>
  );
}

export function useCompletionCache() {
  const cache = useContext(CompletionCacheContext);

  if (!cache) {
    throw new Error("useCompletionCache requiere CompletionProvider.");
  }

  return cache;
}

export function useCompletionState(target: CompletionTarget, date: LocalDate) {
  const cache = useCompletionCache();

  return useSyncExternalStore(
    cache.subscribe,
    () => cache.getState(target, date),
    () => SERVER_COMPLETION_STATE,
  );
}

export function useCompletionAnnouncement() {
  const cache = useCompletionCache();

  return useSyncExternalStore(cache.subscribe, cache.getAnnouncement, () => "");
}
