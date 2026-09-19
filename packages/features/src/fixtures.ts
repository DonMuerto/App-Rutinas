import type { CompletionKey, LocalDate, RoutineMetadata } from "@ritmo/core";

import type {
  AuthServicePort,
  CompletionMutationRepository,
  DraftExitControllerPort,
  QueryCachePort,
  SidebarDataPort,
  TodayActivity,
  TodayDataSource,
  TimerControllerPort,
  TimerPublicSnapshot,
} from "./contracts";

const MORNING_ID = "3947f2ca-d682-42f5-b62f-493a588321ef";
const NIGHT_ID = "247b24d2-999a-4edc-992b-39ceab7313d0";

export const fixtureRoutines: readonly RoutineMetadata[] = [
  {
    id: MORNING_ID,
    name: "Movimiento",
    icon: "M",
    position: 0,
    recurrenceType: "daily",
    specificDate: null,
  },
  {
    id: NIGHT_ID,
    name: "Noche",
    icon: "N",
    position: 1,
    recurrenceType: "daily",
    specificDate: null,
  },
];

function completionIdentity(key: CompletionKey) {
  return JSON.stringify([
    key.completionDate,
    key.routineId,
    key.scopeActivityBlockId,
    key.blockId,
  ]);
}

export class FixtureCompletionRepository implements CompletionMutationRepository {
  readonly completed = new Set<string>();

  async mark(key: CompletionKey) {
    this.completed.add(completionIdentity(key));
  }

  async unmark(key: CompletionKey) {
    this.completed.delete(completionIdentity(key));
  }

  has(
    localDate: LocalDate,
    routineId: string,
    scopeActivityBlockId: string,
    blockId: string,
  ) {
    return this.completed.has(
      completionIdentity({
        completionDate: localDate,
        routineId,
        scopeActivityBlockId,
        blockId,
        blockType: scopeActivityBlockId === blockId ? "activity" : "checklist",
      }),
    );
  }
}

export class FixtureTodayDataSource implements TodayDataSource {
  constructor(private readonly completions: FixtureCompletionRepository) {}

  async load({ localDate, signal }: Parameters<TodayDataSource["load"]>[0]) {
    await Promise.resolve();
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    const activities: TodayActivity[] = [
      {
        routineId: MORNING_ID,
        routineName: "Movimiento",
        routineIcon: "M",
        routinePosition: 0,
        activityBlockId: "activity-mobility",
        documentOrder: 0,
        title: "Circuito de movilidad",
        scheduledTime: "07:30",
        timer: {
          status: "ready",
          config: {
            timerType: "interval",
            prepareSeconds: 10,
            workSeconds: 40,
            restSeconds: 20,
            cycles: 4,
            sets: 2,
            restBetweenSetsSeconds: 60,
          },
        },
        completed: this.completions.has(
          localDate,
          MORNING_ID,
          "activity-mobility",
          "activity-mobility",
        ),
        canComplete: true,
        subtasks: [
          {
            blockId: "checklist-space",
            title: "Preparar espacio",
            relativeDepth: 1,
            completed: this.completions.has(
              localDate,
              MORNING_ID,
              "activity-mobility",
              "checklist-space",
            ),
            canComplete: true,
          },
        ],
        origin: {
          routineId: MORNING_ID,
          activityBlockId: "activity-mobility",
        },
        diagnostics: [],
      },
      {
        routineId: NIGHT_ID,
        routineName: "Noche",
        routineIcon: "N",
        routinePosition: 1,
        activityBlockId: "activity-reading",
        documentOrder: 0,
        title: "Lectura",
        scheduledTime: "22:45",
        timer: {
          status: "ready",
          config: { timerType: "countdown", countdownSeconds: 1_800 },
        },
        completed: this.completions.has(
          localDate,
          NIGHT_ID,
          "activity-reading",
          "activity-reading",
        ),
        canComplete: true,
        subtasks: [],
        origin: {
          routineId: NIGHT_ID,
          activityBlockId: "activity-reading",
        },
        diagnostics: [],
      },
    ];
    return { activities, diagnostics: [] };
  }
}

export class FixtureTimerController implements TimerControllerPort {
  private snapshot: TimerPublicSnapshot = { status: "idle" };
  private readonly listeners = new Set<() => void>();

  readonly getSnapshot = () => this.snapshot;
  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  async start(request: Parameters<TimerControllerPort["start"]>[0]) {
    if (this.snapshot.status !== "idle") {
      return { ok: false, reason: "occupied" } as const;
    }
    this.snapshot = { status: "running", origin: request.origin };
    this.emit();
    return { ok: true } as const;
  }

  openFocus() {}

  async clearForUser() {
    this.snapshot = { status: "idle" };
    this.emit();
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }
}

export function createFixtureSidebarData(): SidebarDataPort {
  return {
    async createRoutine(name) {
      return {
        id: crypto.randomUUID(),
        name,
        icon: null,
        position: fixtureRoutines.length,
        recurrenceType: "daily",
        specificDate: null,
      };
    },
    async reorderRoutines() {},
  };
}

export const fixtureAuthService: AuthServicePort = {
  async login() {},
  async register() {},
  async logout() {},
};

export const fixtureDraftController: DraftExitControllerPort = {
  async inspectForExit() {
    return { pendingCount: 0, canSync: true };
  },
  async syncAll() {
    return true;
  },
  async saveCopyAndDiscard() {},
  async discardAll() {},
  async lockForReauthentication() {},
};

export const fixtureQueryCache: QueryCachePort = {
  async cancelUserQueries() {},
  clearUser() {},
};
