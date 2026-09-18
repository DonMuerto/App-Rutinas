import {
  activityScheduledTimeSchema,
  activityTimerConfigSchema,
  type ActivityTimerConfig,
  type CompletionKey,
  type LocalDate,
  type RoutineMetadata,
  type ScheduledTime,
} from "@/lib/contracts";
import type { DocumentDiagnostic } from "@/lib/blocknote/document";
import { supportedBlockTypes } from "@/lib/blocknote/document";
import { getInlinePlainText } from "@/lib/blocknote/inline-text";
import { isRecord } from "@/lib/blocknote/unknown";

export interface ProjectedSubtask {
  readonly blockId?: string;
  readonly title: string;
  readonly relativeDepth: number;
  readonly completed: boolean;
  readonly canComplete: boolean;
}

export type ProjectedTimer =
  | { readonly status: "none" }
  | {
      readonly status: "ready";
      readonly config: Exclude<ActivityTimerConfig, { timerType: "none" }>;
    }
  | { readonly status: "invalid" };

export interface ProjectedActivity {
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
  readonly timerActive: boolean;
  readonly subtasks: readonly ProjectedSubtask[];
  readonly origin?: {
    readonly routineId: string;
    readonly activityBlockId: string;
  };
  readonly diagnostics: readonly ProjectionDiagnostic[];
}

export type ProjectionDiagnosticCode =
  | "DOCUMENT_ROOT_INVALID"
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

export interface ProjectionDiagnostic {
  readonly code: ProjectionDiagnosticCode;
  readonly path: readonly (string | number)[];
  readonly blockId?: string;
  readonly message: string;
}

export interface ActivityProjectionResult {
  readonly activities: readonly ProjectedActivity[];
  readonly diagnostics: readonly ProjectionDiagnostic[];
}

export interface ProjectActivitiesInput {
  readonly routine: RoutineMetadata & { readonly content: unknown };
  readonly completionDate: LocalDate;
  readonly completions?: readonly CompletionKey[];
  readonly activeTimer?: {
    readonly routineId: string;
    readonly activityBlockId: string;
  };
}

interface MutableProjectedActivity extends Omit<
  ProjectedActivity,
  "subtasks" | "diagnostics"
> {
  subtasks: ProjectedSubtask[];
  diagnostics: ProjectionDiagnostic[];
}

interface ActivityScope {
  readonly projected: MutableProjectedActivity;
  readonly blockId?: string;
  readonly absoluteDepth: number;
}

function isCompleted(
  completions: readonly CompletionKey[],
  key: Omit<CompletionKey, "blockType"> & Pick<CompletionKey, "blockType">,
) {
  return completions.some(
    (completion) =>
      completion.routineId === key.routineId &&
      completion.scopeActivityBlockId === key.scopeActivityBlockId &&
      completion.blockId === key.blockId &&
      completion.blockType === key.blockType &&
      completion.completionDate === key.completionDate,
  );
}

function inspectTimer(props: Record<string, unknown>): ProjectedTimer {
  const result = activityTimerConfigSchema.safeParse(props);
  if (!result.success) {
    return { status: "invalid" };
  }

  return result.data.timerType === "none"
    ? { status: "none" }
    : { status: "ready", config: result.data };
}

export function projectActivities({
  routine,
  completionDate,
  completions = [],
  activeTimer,
}: ProjectActivitiesInput): ActivityProjectionResult {
  const activities: MutableProjectedActivity[] = [];
  const diagnostics: ProjectionDiagnostic[] = [];
  const idCounts = new Map<string, number>();
  let documentOrder = 0;

  const countIds = (blocks: unknown) => {
    if (!Array.isArray(blocks)) return;
    blocks.forEach((candidate) => {
      if (!isRecord(candidate)) return;
      if (typeof candidate.id === "string" && candidate.id.length > 0) {
        idCounts.set(candidate.id, (idCounts.get(candidate.id) ?? 0) + 1);
      }
      countIds(candidate.children);
    });
  };
  countIds(routine.content);

  const walk = (
    blocks: unknown,
    depth: number,
    scope: ActivityScope | undefined,
    path: readonly (string | number)[],
  ) => {
    if (!Array.isArray(blocks)) {
      diagnostics.push({
        code:
          path.length === 0
            ? "DOCUMENT_ROOT_INVALID"
            : "BLOCK_CHILDREN_INVALID",
        path,
        message:
          path.length === 0
            ? "El documento no contiene una lista de bloques valida."
            : "Los descendientes del bloque no tienen un formato valido.",
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
        !supportedBlockTypes.some((type) => type === candidate.type)
      ) {
        diagnostics.push({
          code: "BLOCK_TYPE_INVALID",
          path: [...blockPath, "type"],
          blockId: typeof candidate.id === "string" ? candidate.id : undefined,
          message: "El tipo de bloque no esta registrado.",
        });
      }

      const rawBlockId =
        typeof candidate.id === "string" && candidate.id.length > 0
          ? candidate.id
          : undefined;
      const blockId =
        rawBlockId && idCounts.get(rawBlockId) === 1 ? rawBlockId : undefined;
      const props = isRecord(candidate.props) ? candidate.props : {};
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
        const versionValid = props.schemaVersion === 1;
        const scheduledTimeResult = activityScheduledTimeSchema.safeParse(
          props.scheduledTime,
        );
        const timer = versionValid
          ? inspectTimer(props)
          : { status: "invalid" as const };

        if (!versionValid) {
          activityDiagnostics.push({
            code: "ACTIVITY_SCHEMA_VERSION_INVALID",
            path: [...blockPath, "props", "schemaVersion"],
            blockId,
            message: "La version de Activity no es compatible.",
          });
        }
        if (!scheduledTimeResult.success) {
          activityDiagnostics.push({
            code: "ACTIVITY_SCHEDULED_TIME_INVALID",
            path: [...blockPath, "props", "scheduledTime"],
            blockId,
            message: "La hora programada no es valida.",
          });
        }
        if (timer.status === "invalid") {
          activityDiagnostics.push({
            code: "ACTIVITY_TIMER_INVALID",
            path: [...blockPath, "props"],
            blockId,
            message: "La configuracion del temporizador no es valida.",
          });
        }
        if (!blockId) {
          activityDiagnostics.push({
            code: rawBlockId ? "BLOCK_ID_DUPLICATE" : "ACTIVITY_ID_MISSING",
            path: [...blockPath, "id"],
            blockId: rawBlockId,
            message: rawBlockId
              ? "La actividad tiene un ID duplicado."
              : "La actividad no tiene un ID estable.",
          });
        }

        const canComplete = blockId !== undefined;
        const projected: MutableProjectedActivity = {
          routineId: routine.id,
          routineName: routine.name,
          routineIcon: routine.icon,
          routinePosition: routine.position,
          activityBlockId: blockId,
          documentOrder,
          title,
          scheduledTime: scheduledTimeResult.success
            ? scheduledTimeResult.data
            : undefined,
          timer,
          completed:
            blockId === undefined
              ? false
              : isCompleted(completions, {
                  routineId: routine.id,
                  scopeActivityBlockId: blockId,
                  blockId,
                  blockType: "activity",
                  completionDate,
                }),
          canComplete,
          timerActive:
            blockId !== undefined &&
            activeTimer?.routineId === routine.id &&
            activeTimer.activityBlockId === blockId,
          subtasks: [],
          origin: blockId
            ? { routineId: routine.id, activityBlockId: blockId }
            : undefined,
          diagnostics: activityDiagnostics,
        };
        documentOrder += 1;
        activities.push(projected);
        diagnostics.push(...activityDiagnostics);
        childScope = { projected, blockId, absoluteDepth: depth };
      } else if (candidate.type === "checkListItem" && scope) {
        const subtaskDiagnostics: ProjectionDiagnostic[] = [];
        const inlineIssues: {
          path: readonly (string | number)[];
          message: string;
        }[] = [];
        const title = getInlinePlainText(
          candidate.content ?? [],
          [...blockPath, "content"],
          inlineIssues,
        );
        subtaskDiagnostics.push(
          ...inlineIssues.map((issue) => ({
            code: "INLINE_CONTENT_INVALID" as const,
            path: issue.path,
            blockId,
            message: issue.message,
          })),
        );
        const canComplete =
          blockId !== undefined && scope.blockId !== undefined;

        if (!blockId) {
          const diagnostic: ProjectionDiagnostic = {
            code: rawBlockId ? "BLOCK_ID_DUPLICATE" : "CHECKLIST_ID_MISSING",
            path: [...blockPath, "id"],
            blockId: rawBlockId,
            message: rawBlockId
              ? "La subtarea tiene un ID duplicado."
              : "La subtarea no tiene un ID estable.",
          };
          subtaskDiagnostics.push(diagnostic);
        }

        diagnostics.push(...subtaskDiagnostics);
        scope.projected.diagnostics.push(...subtaskDiagnostics);
        scope.projected.subtasks.push({
          blockId,
          title,
          relativeDepth: depth - scope.absoluteDepth,
          completed:
            canComplete && blockId && scope.blockId
              ? isCompleted(completions, {
                  routineId: routine.id,
                  scopeActivityBlockId: scope.blockId,
                  blockId,
                  blockType: "checklist",
                  completionDate,
                })
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

  walk(routine.content, 0, undefined, []);

  return { activities, diagnostics };
}

export function sortProjectedActivities(
  activities: readonly ProjectedActivity[],
): ProjectedActivity[] {
  return [...activities].sort((left, right) => {
    if (left.scheduledTime && !right.scheduledTime) return -1;
    if (!left.scheduledTime && right.scheduledTime) return 1;

    return (
      (left.scheduledTime ?? "").localeCompare(right.scheduledTime ?? "") ||
      left.routinePosition - right.routinePosition ||
      left.documentOrder - right.documentOrder ||
      left.routineId.localeCompare(right.routineId) ||
      (left.activityBlockId ?? "").localeCompare(right.activityBlockId ?? "")
    );
  });
}

export type { DocumentDiagnostic };
