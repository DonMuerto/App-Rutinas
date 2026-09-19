import type { CompletionKey, LocalDate, RoutineMetadata } from "@ritmo/core";

import type {
  CompletionMutationRepository,
  SidebarDataPort,
  TodayDataSource,
  TodayReadModel,
  TimerControllerPort,
  TimerPublicSnapshot,
} from "./contracts";

interface RoutineSidebarRepository {
  create(input: {
    readonly name: string;
    readonly icon?: string | null;
    readonly recurrenceType: "daily";
    readonly specificDate: null;
  }): Promise<RoutineMetadata>;
  reorder(orderedIds: string[]): Promise<void>;
}

export function createSidebarDataPort(
  repository: RoutineSidebarRepository,
): SidebarDataPort {
  return {
    createRoutine(name) {
      return repository.create({
        name,
        recurrenceType: "daily",
        specificDate: null,
      });
    },
    reorderRoutines(routineIds) {
      return repository.reorder([...routineIds]);
    },
  };
}

type TodayRoutine = RoutineMetadata & {
  readonly content: unknown;
};

interface TodayRoutineRepository {
  listForDate(date: LocalDate): Promise<readonly TodayRoutine[]>;
}

interface TodayCompletionRepository extends CompletionMutationRepository {
  list(
    routineIds: string[],
    completionDate: LocalDate,
  ): Promise<readonly CompletionKey[]>;
}

interface ActivityProjector {
  (input: {
    readonly routine: TodayRoutine;
    readonly completionDate: LocalDate;
    readonly completions: readonly CompletionKey[];
    readonly activeTimer?: {
      readonly routineId: string;
      readonly activityBlockId: string;
    };
  }): TodayReadModel;
}

export function createTodayDataSource(options: {
  readonly routines: TodayRoutineRepository;
  readonly completions: TodayCompletionRepository;
  readonly project: ActivityProjector;
  readonly getActiveTimer?: () =>
    | { readonly routineId: string; readonly activityBlockId: string }
    | undefined;
}): TodayDataSource {
  return {
    async load({ localDate, signal }) {
      const routines = await options.routines.listForDate(localDate);
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");

      const completions = await options.completions.list(
        routines.map((routine) => routine.id),
        localDate,
      );
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");

      const activeTimer = options.getActiveTimer?.();
      const models = routines.map((routine) =>
        options.project({
          routine,
          completionDate: localDate,
          completions,
          activeTimer,
        }),
      );
      return {
        activities: models.flatMap((model) => model.activities),
        diagnostics: models.flatMap((model) => model.diagnostics),
      };
    },
  };
}

interface SourceTimerSnapshot {
  readonly timer:
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
}

interface SourceTimerController {
  getSnapshot(): SourceTimerSnapshot;
  subscribe(listener: () => void): () => void;
  start(request: Parameters<TimerControllerPort["start"]>[0]): Promise<{
    readonly ok: boolean;
    readonly reason?: string;
  }>;
  openFocus(): unknown;
  logout(): Promise<void>;
}

export function createTimerControllerPort(
  controller: SourceTimerController,
): TimerControllerPort {
  let sourceSnapshot: SourceTimerSnapshot | null = null;
  let publicSnapshot: TimerPublicSnapshot = { status: "idle" };

  function getSnapshot() {
    const nextSource = controller.getSnapshot();
    if (nextSource === sourceSnapshot) return publicSnapshot;
    sourceSnapshot = nextSource;
    publicSnapshot =
      nextSource.timer.status === "idle"
        ? { status: "idle" }
        : {
            status: nextSource.timer.status,
            origin: nextSource.timer.origin,
          };
    return publicSnapshot;
  }

  return {
    getSnapshot,
    subscribe: controller.subscribe,
    async start(request) {
      const result = await controller.start(request);
      return result.ok
        ? { ok: true }
        : { ok: false, reason: result.reason ?? "unknown" };
    },
    openFocus() {
      controller.openFocus();
    },
    async clearForUser() {
      await controller.logout();
    },
  };
}
