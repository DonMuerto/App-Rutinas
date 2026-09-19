import type {
  ActivityTimerConfig,
  CompletionKey,
  LocalDate,
  RoutineMetadata,
  ScheduledTime,
} from "@ritmo/core";

import { inspectActivityProps } from "./activity";
import { migrateDocumentEnvelope } from "./envelope";
import { getInlinePlainText } from "./inline-text";
import { isRecord, isSupportedBlockType } from "./types";

export interface ProjectedSubtask {
  blockId?: string;
  title: string;
  relativeDepth: number;
  completed: boolean;
  canComplete: boolean;
}

export type ProjectedTimer =
  | { status: "none" }
  | {
      status: "ready";
      config: Exclude<ActivityTimerConfig, { timerType: "none" }>;
    }
  | { status: "invalid" };

export interface ProjectionDiagnostic {
  code:
    | "DOCUMENT_INVALID"
    | "BLOCK_INVALID"
    | "BLOCK_TYPE_INVALID"
    | "BLOCK_CHILDREN_INVALID"
    | "ACTIVITY_SCHEMA_VERSION_INVALID"
    | "ACTIVITY_SCHEDULED_TIME_INVALID"
    | "ACTIVITY_TIMER_INVALID"
    | "ACTIVITY_ID_MISSING"
    | "CHECKLIST_ID_MISSING"
    | "BLOCK_ID_DUPLICATE"
    | "INLINE_CONTENT_INVALID";
  path: readonly (string | number)[];
  blockId?: string;
  message: string;
}

export interface ProjectedActivity {
  routineId: string;
  routineName: string;
  routineIcon: string | null;
  routinePosition: number;
  activityBlockId?: string;
  documentOrder: number;
  title: string;
  scheduledTime?: ScheduledTime;
  timer: ProjectedTimer;
  completed: boolean;
  canComplete: boolean;
  timerActive: boolean;
  subtasks: readonly ProjectedSubtask[];
  origin?: { routineId: string; activityBlockId: string };
  diagnostics: readonly ProjectionDiagnostic[];
}

export interface ActivityProjectionResult {
  activities: readonly ProjectedActivity[];
  diagnostics: readonly ProjectionDiagnostic[];
}

export interface ProjectActivitiesInput {
  routine: RoutineMetadata & { content: unknown };
  completionDate: LocalDate;
  completions?: readonly CompletionKey[];
  activeTimer?: { routineId: string; activityBlockId: string };
}

interface MutableActivity extends Omit<
  ProjectedActivity,
  "subtasks" | "diagnostics"
> {
  subtasks: ProjectedSubtask[];
  diagnostics: ProjectionDiagnostic[];
}

function completionIdentity(key: CompletionKey) {
  return JSON.stringify([
    key.routineId,
    key.scopeActivityBlockId,
    key.blockId,
    key.blockType,
    key.completionDate,
  ]);
}

export function projectActivities({
  routine,
  completionDate,
  completions = [],
  activeTimer,
}: ProjectActivitiesInput): ActivityProjectionResult {
  const migration = migrateDocumentEnvelope(routine.content);
  if (migration.kind === "recovery") {
    return {
      activities: [],
      diagnostics: [
        {
          code: "DOCUMENT_INVALID",
          path: [],
          message: migration.diagnostics[0]?.message ?? "Documento invalido.",
        },
      ],
    };
  }

  const activities: MutableActivity[] = [];
  const diagnostics: ProjectionDiagnostic[] = [];
  const idCounts = new Map<string, number>();
  const completed = new Set(completions.map(completionIdentity));
  let documentOrder = 0;

  const countIds = (blocks: unknown) => {
    if (!Array.isArray(blocks)) return;
    for (const candidate of blocks) {
      if (!isRecord(candidate)) continue;
      if (typeof candidate.id === "string" && candidate.id.length > 0) {
        idCounts.set(candidate.id, (idCounts.get(candidate.id) ?? 0) + 1);
      }
      countIds(candidate.children);
    }
  };
  countIds(migration.document.blocks);

  const isCompleted = (
    scopeActivityBlockId: string,
    blockId: string,
    blockType: "activity" | "checklist",
  ) =>
    completed.has(
      completionIdentity({
        routineId: routine.id,
        scopeActivityBlockId,
        blockId,
        blockType,
        completionDate,
      }),
    );

  const walk = (
    blocks: unknown,
    depth: number,
    scope:
      | { activity: MutableActivity; blockId?: string; depth: number }
      | undefined,
    path: readonly (string | number)[],
  ) => {
    if (!Array.isArray(blocks)) {
      diagnostics.push({
        code: "BLOCK_CHILDREN_INVALID",
        path,
        message: "Los descendientes no tienen un formato valido.",
      });
      return;
    }

    blocks.forEach((candidate, index) => {
      const blockPath = [...path, index];
      if (!isRecord(candidate)) {
        diagnostics.push({
          code: "BLOCK_INVALID",
          path: blockPath,
          message: "El bloque no tiene un formato valido.",
        });
        return;
      }

      if (
        typeof candidate.type !== "string" ||
        !isSupportedBlockType(candidate.type)
      ) {
        diagnostics.push({
          code: "BLOCK_TYPE_INVALID",
          path: [...blockPath, "type"],
          blockId: typeof candidate.id === "string" ? candidate.id : undefined,
          message: "El tipo de bloque no esta registrado.",
        });
      }

      const rawId =
        typeof candidate.id === "string" && candidate.id.length > 0
          ? candidate.id
          : undefined;
      const blockId = rawId && idCounts.get(rawId) === 1 ? rawId : undefined;
      let childScope = scope;

      if (candidate.type === "activity") {
        const activityDiagnostics: ProjectionDiagnostic[] = [];
        const inlineIssues: {
          path: readonly (string | number)[];
          message: string;
        }[] = [];
        const title = getInlinePlainText(
          candidate.content ?? [],
          [...blockPath, "content"],
          inlineIssues,
        );
        activityDiagnostics.push(
          ...inlineIssues.map((issue) => ({
            code: "INLINE_CONTENT_INVALID" as const,
            path: issue.path,
            blockId,
            message: issue.message,
          })),
        );
        const inspected = inspectActivityProps(candidate.props);
        if (!inspected.schemaVersionValid) {
          activityDiagnostics.push({
            code: "ACTIVITY_SCHEMA_VERSION_INVALID",
            path: [...blockPath, "props", "schemaVersion"],
            blockId,
            message: "La version de Activity no es compatible.",
          });
        }
        if (inspected.scheduledTimeError) {
          activityDiagnostics.push({
            code: "ACTIVITY_SCHEDULED_TIME_INVALID",
            path: [...blockPath, "props", "scheduledTime"],
            blockId,
            message: inspected.scheduledTimeError,
          });
        }
        if (inspected.timer.status === "invalid") {
          activityDiagnostics.push({
            code: "ACTIVITY_TIMER_INVALID",
            path: [...blockPath, "props"],
            blockId,
            message: inspected.timer.message,
          });
        }
        if (!blockId) {
          activityDiagnostics.push({
            code: rawId ? "BLOCK_ID_DUPLICATE" : "ACTIVITY_ID_MISSING",
            path: [...blockPath, "id"],
            blockId: rawId,
            message: rawId
              ? "La Activity tiene un ID duplicado."
              : "La Activity no tiene un ID estable.",
          });
        }

        const activity: MutableActivity = {
          routineId: routine.id,
          routineName: routine.name,
          routineIcon: routine.icon,
          routinePosition: routine.position,
          activityBlockId: blockId,
          documentOrder: documentOrder++,
          title,
          scheduledTime: inspected.scheduledTime,
          timer:
            inspected.timer.status === "ready"
              ? { status: "ready", config: inspected.timer.config }
              : inspected.timer.status === "none"
                ? { status: "none" }
                : { status: "invalid" },
          completed: blockId
            ? isCompleted(blockId, blockId, "activity")
            : false,
          canComplete: blockId !== undefined,
          timerActive:
            blockId !== undefined &&
            activeTimer?.routineId === routine.id &&
            activeTimer?.activityBlockId === blockId,
          subtasks: [],
          origin: blockId
            ? { routineId: routine.id, activityBlockId: blockId }
            : undefined,
          diagnostics: activityDiagnostics,
        };
        activities.push(activity);
        diagnostics.push(...activityDiagnostics);
        childScope = { activity, blockId, depth };
      } else if (candidate.type === "checkListItem" && scope) {
        const inlineIssues: {
          path: readonly (string | number)[];
          message: string;
        }[] = [];
        const title = getInlinePlainText(
          candidate.content ?? [],
          [...blockPath, "content"],
          inlineIssues,
        );
        const canComplete =
          blockId !== undefined && scope.blockId !== undefined;
        if (!blockId) {
          const issue: ProjectionDiagnostic = {
            code: rawId ? "BLOCK_ID_DUPLICATE" : "CHECKLIST_ID_MISSING",
            path: [...blockPath, "id"],
            blockId: rawId,
            message: rawId
              ? "La subtarea tiene un ID duplicado."
              : "La subtarea no tiene un ID estable.",
          };
          diagnostics.push(issue);
          scope.activity.diagnostics.push(issue);
        }
        for (const inlineIssue of inlineIssues) {
          const issue: ProjectionDiagnostic = {
            code: "INLINE_CONTENT_INVALID",
            path: inlineIssue.path,
            blockId,
            message: inlineIssue.message,
          };
          diagnostics.push(issue);
          scope.activity.diagnostics.push(issue);
        }
        scope.activity.subtasks.push({
          blockId,
          title,
          relativeDepth: depth - scope.depth,
          completed:
            canComplete && blockId && scope.blockId
              ? isCompleted(scope.blockId, blockId, "checklist")
              : false,
          canComplete,
        });
      }

      if (candidate.children !== undefined) {
        walk(candidate.children, depth + 1, childScope, [
          ...blockPath,
          "children",
        ]);
      }
    });
  };

  walk(migration.document.blocks, 0, undefined, ["blocks"]);
  return { activities, diagnostics };
}

export function sortProjectedActivities(
  activities: readonly ProjectedActivity[],
) {
  return [...activities].sort(
    (left, right) =>
      (left.scheduledTime && !right.scheduledTime
        ? -1
        : !left.scheduledTime && right.scheduledTime
          ? 1
          : 0) ||
      (left.scheduledTime ?? "").localeCompare(right.scheduledTime ?? "") ||
      left.routinePosition - right.routinePosition ||
      left.documentOrder - right.documentOrder ||
      left.routineId.localeCompare(right.routineId) ||
      (left.activityBlockId ?? "").localeCompare(right.activityBlockId ?? ""),
  );
}
