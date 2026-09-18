import type { LocalDate } from "@/lib/contracts";
import type {
  ProjectedActivity,
  ProjectionDiagnostic,
} from "@/lib/activities/project-activities";

export type TodayActivity = ProjectedActivity;

export interface TodayDiagnostic {
  routineId: string;
  diagnostic: ProjectionDiagnostic;
}

export interface TodayReadModel {
  activities: readonly TodayActivity[];
  diagnostics: readonly TodayDiagnostic[];
}

export interface TodayDataSource {
  load(date: LocalDate, signal: AbortSignal): Promise<TodayReadModel>;
}

export type OriginHrefBuilder = (origin: {
  routineId: string;
  activityBlockId: string;
}) => string;
