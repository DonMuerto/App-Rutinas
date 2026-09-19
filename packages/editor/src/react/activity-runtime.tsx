/* eslint-disable react-refresh/only-export-components -- Context and its hook form one public runtime boundary. */
import { createContext, useContext, type ReactNode } from "react";
import type {
  ActivityTimerConfig,
  CompletionKey,
  LocalDate,
} from "@ritmo/core";

export interface ActivityTimerStartRequest {
  origin: {
    routineId: string;
    routineName: string;
    activityBlockId: string;
    activityTitle: string;
  };
  config: Exclude<ActivityTimerConfig, { timerType: "none" }>;
}

export type ActivityTimerStartResult =
  { ok: true } | { ok: false; reason: "occupied" | "invalid" };

export interface EditorTimerPort {
  start(
    request: ActivityTimerStartRequest,
  ): ActivityTimerStartResult | Promise<ActivityTimerStartResult>;
  openFocus(): void;
}

export interface EditorCompletionPort {
  getState(key: CompletionKey): { completed: boolean; pending: boolean };
  setCompleted(key: CompletionKey, completed: boolean): Promise<void>;
}

export interface ActivityRuntimeValue {
  routineId: string;
  routineName: string;
  localDate: LocalDate;
  completions: EditorCompletionPort;
  timer?: EditorTimerPort;
  canUseBlockId(blockId: string): boolean;
  announce(message: string): void;
}

const ActivityRuntimeContext = createContext<ActivityRuntimeValue | null>(null);

export function ActivityRuntimeProvider({
  value,
  children,
}: {
  value: ActivityRuntimeValue;
  children: ReactNode;
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
