import type {
  ActivityTimerConfig,
  CompletionKey,
  LocalDate,
  RoutineMetadata,
  ScheduledTime,
} from "@ritmo/core";

export interface AuthUser {
  readonly id: string;
  readonly email?: string;
  readonly displayName?: string;
}

export interface AuthCredentials {
  readonly email: string;
  readonly password: string;
}

export interface AuthServicePort {
  login(email: string, password: string): Promise<unknown>;
  register(email: string, password: string): Promise<unknown>;
  logout(): Promise<void>;
}

export interface CompletionMutationRepository {
  mark(key: CompletionKey, signal?: AbortSignal): Promise<void>;
  unmark(key: CompletionKey, signal?: AbortSignal): Promise<void>;
}

export interface SidebarDataPort {
  createRoutine(name: string): Promise<RoutineMetadata>;
  reorderRoutines(routineIds: readonly string[]): Promise<void>;
}

export type RunnableTimerConfig = Exclude<
  ActivityTimerConfig,
  { timerType: "none" }
>;

export type ProjectedTimer =
  | { readonly status: "none" }
  | { readonly status: "invalid" }
  | { readonly status: "ready"; readonly config: RunnableTimerConfig };

export interface TodaySubtask {
  readonly blockId?: string;
  readonly title: string;
  readonly relativeDepth: number;
  readonly completed: boolean;
  readonly canComplete: boolean;
}

export interface TodayActivity {
  readonly routineId: string;
  readonly routineName: string;
  readonly routineIcon: string | null;
  readonly routinePosition: number;
  readonly activityBlockId?: string;
  readonly documentOrder: number;
  readonly title: string;
  readonly scheduledTime?: ScheduledTime;
  readonly timer: ProjectedTimer;
  readonly completed: boolean;
  readonly canComplete: boolean;
  readonly subtasks: readonly TodaySubtask[];
  readonly origin?: {
    readonly routineId: string;
    readonly activityBlockId: string;
  };
  readonly diagnostics: readonly { readonly message: string }[];
}

export interface TodayReadModel {
  readonly activities: readonly TodayActivity[];
  readonly diagnostics: readonly { readonly message: string }[];
}

export interface TodayDataSource {
  load(input: {
    readonly userId: string;
    readonly localDate: LocalDate;
    readonly signal: AbortSignal;
  }): Promise<TodayReadModel>;
}

export type TimerPublicSnapshot =
  | { readonly status: "idle" }
  | {
      readonly status: "running" | "done";
      readonly origin: {
        readonly routineId: string;
        readonly routineName: string;
        readonly activityId: string;
        readonly activityTitle: string;
      };
    };

export interface TimerControllerPort {
  getSnapshot(): TimerPublicSnapshot;
  subscribe(listener: () => void): () => void;
  start(request: {
    readonly config: RunnableTimerConfig;
    readonly origin: {
      readonly routineId: string;
      readonly routineName: string;
      readonly activityId: string;
      readonly activityTitle: string;
    };
  }): Promise<
    { readonly ok: true } | { readonly ok: false; readonly reason: string }
  >;
  openFocus(): void;
  clearForUser(userId: string): Promise<void>;
}

export interface DraftExitState {
  readonly pendingCount: number;
  readonly canSync: boolean;
}

export interface DraftExitControllerPort {
  inspectForExit(userId: string): Promise<DraftExitState>;
  syncAll(userId: string): Promise<boolean>;
  saveCopyAndDiscard(userId: string): Promise<void>;
  discardAll(userId: string): Promise<void>;
  lockForReauthentication(userId: string): Promise<void>;
}

export interface QueryCachePort {
  cancelUserQueries(userId: string): Promise<void>;
  clearUser(userId: string): void;
}

export type SessionExitDecision = "sync" | "save-copy" | "discard" | "cancel";

export type SessionExitDecisionPrompt = (
  state: DraftExitState,
) => Promise<SessionExitDecision>;
