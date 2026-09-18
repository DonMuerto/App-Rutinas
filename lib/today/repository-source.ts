import { projectActivities } from "@/lib/activities/project-activities";
import type { LocalDate } from "@/lib/contracts";
import type {
  CompletionRepository,
  RoutineRepository,
} from "@/lib/repositories";

import type { TodayDataSource, TodayReadModel } from "./types";

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
}

export interface TodayRepositories {
  routines: Pick<RoutineRepository, "listForDate">;
  completions: CompletionRepository;
}

export class RepositoryTodayDataSource implements TodayDataSource {
  constructor(private readonly repositories: TodayRepositories) {}

  async load(date: LocalDate, signal: AbortSignal): Promise<TodayReadModel> {
    const routines = await this.repositories.routines.listForDate(date);
    throwIfAborted(signal);

    const completions = await this.repositories.completions.list(
      routines.map((routine) => routine.id),
      date,
    );
    throwIfAborted(signal);

    const activities: TodayReadModel["activities"][number][] = [];
    const diagnostics: TodayReadModel["diagnostics"][number][] = [];

    for (const routine of routines) {
      const projection = projectActivities({
        routine,
        completionDate: date,
        completions,
      });
      activities.push(...projection.activities);
      diagnostics.push(
        ...projection.diagnostics.map((diagnostic) => ({
          routineId: routine.id,
          diagnostic,
        })),
      );
    }

    return { activities, diagnostics };
  }
}
