"use client";

import { createContext, useContext, type ReactNode } from "react";

import type {
  ActivityTimerConfig,
  CompletionKey,
  LocalDate,
} from "@/lib/contracts";

export interface ActivityTimerStartRequest {
  readonly routineId: string;
  readonly routineName: string;
  readonly activityBlockId: string;
  readonly activityTitle: string;
  readonly config: Exclude<ActivityTimerConfig, { timerType: "none" }>;
}

export interface ActivityRuntimeValue {
  readonly routineId: string;
  readonly routineName: string;
  readonly localDate: LocalDate;
  readonly isCompleted: (
    scopeActivityBlockId: string,
    blockId: string,
  ) => boolean;
  readonly isCompletionPending?: (
    scopeActivityBlockId: string,
    blockId: string,
  ) => boolean;
  readonly canUseBlockId?: (blockId: string) => boolean;
  readonly toggleCompletion: (
    key: CompletionKey,
    completed: boolean,
  ) => void | Promise<void>;
  readonly startTimer?: (
    request: ActivityTimerStartRequest,
  ) => void | Promise<void>;
}

const ActivityRuntimeContext = createContext<ActivityRuntimeValue | null>(null);

export function ActivityRuntimeProvider({
  value,
  children,
}: {
  readonly value: ActivityRuntimeValue;
  readonly children: ReactNode;
}) {
  return (
    <ActivityRuntimeContext.Provider value={value}>
      {children}
    </ActivityRuntimeContext.Provider>
  );
}

export function useActivityRuntime() {
  return useContext(ActivityRuntimeContext);
}
