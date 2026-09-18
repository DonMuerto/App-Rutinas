"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { useEffect, useRef, useState } from "react";

import {
  ActivityRuntimeProvider,
  type ActivityRuntimeValue,
} from "./activity-runtime";
import { ActivitySlashMenu } from "./activity-slash-menu";
import {
  applyDailyChecklistState,
  interceptDailyChecklistClick,
  normalizeChecklistScopeTransitions,
} from "./checklist-completions";
import { RoutineMetadataEditor } from "./routine-metadata";
import { useAutosave } from "./use-autosave";
import { useSafeNavigation } from "./use-safe-navigation";
import styles from "./editor.module.css";
import type { Routine, RoutineDocument } from "@/lib/contracts";
import {
  ritmoSchema,
  type RitmoBlock,
} from "@/lib/blocknote/activity-block-spec";
import {
  inspectDocument,
  getStableBlockIds,
  normalizeActivityChecklists,
  type DocumentInspection,
} from "@/lib/blocknote/document";
import { focusBlockById } from "@/lib/blocknote/focus-block";
import {
  getChecklistActivityScopes,
  isInsideActivity,
} from "@/lib/blocknote/activity-scope";

export interface RoutineEditorProps {
  readonly routine: Routine;
  readonly runtime: ActivityRuntimeValue;
  readonly requestedBlockId?: string;
  readonly theme?: "light" | "dark";
  readonly saveDocument: (content: RoutineDocument) => Promise<void>;
  readonly renameRoutine: (name: string) => Promise<void>;
  readonly changeIcon: (icon: string | null) => Promise<void>;
  readonly changeRecurrence: (
    recurrence: Pick<Routine, "recurrenceType" | "specificDate">,
  ) => Promise<void>;
  readonly onRequestedBlockMissing?: (blockId: string) => void;
}

const saveLabels = {
  idle: "Sin cambios",
  pending: "Cambios pendientes",
  saving: "Guardando...",
  saved: "Guardado",
  error: "No se pudo guardar. La edicion local se conserva.",
} as const;

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "El documento original no se puede representar como texto.";
  }
}

function RecoveryDocument({
  inspection,
}: {
  readonly inspection: Extract<DocumentInspection, { kind: "recovery" }>;
}) {
  return (
    <section aria-labelledby="recovery-title" className={styles.recovery}>
      <h2 id="recovery-title">Documento en recuperacion</h2>
      <p>
        Este documento contiene bloques que el editor no puede montar sin riesgo
        de perdida. Se muestra en modo de solo lectura y no se guardara
        automaticamente.
      </p>
      <ul>
        {inspection.diagnostics.map((diagnostic, index) => (
          <li key={`${diagnostic.code}-${index}`}>{diagnostic.message}</li>
        ))}
      </ul>
      <details>
        <summary>Ver JSON conservado</summary>
        <pre>{safeJson(inspection.original)}</pre>
      </details>
    </section>
  );
}

function EditableRoutineDocument({
  inspection,
  routine,
  runtime,
  requestedBlockId,
  theme,
  saveDocument,
  renameRoutine,
  changeIcon,
  changeRecurrence,
  onRequestedBlockMissing,
}: Omit<RoutineEditorProps, "routine"> & {
  readonly routine: Routine;
  readonly inspection: Extract<DocumentInspection, { kind: "editable" }>;
}) {
  const viewRef = useRef<HTMLDivElement>(null);
  const focusedRequestRef = useRef<string | undefined>(undefined);
  const [navigationError, setNavigationError] = useState<Error>();
  const editor = useCreateBlockNote(
    {
      schema: ritmoSchema,
      initialContent: inspection.initialContent,
      tabBehavior: "prefer-indent",
    },
    [routine.id],
  );
  const checklistScopesRef = useRef(
    getChecklistActivityScopes(editor.document as RitmoBlock[]),
  );
  const persistedBlockIdsRef = useRef(inspection.stableBlockIds);
  const { controller, snapshot } = useAutosave(
    async (content: RoutineDocument) => {
      await saveDocument(content);
      persistedBlockIdsRef.current = getStableBlockIds(
        content as unknown as RitmoBlock[],
      );
    },
  );
  useSafeNavigation(controller, setNavigationError);

  const syncChecklists = () => {
    if (viewRef.current) {
      applyDailyChecklistState(viewRef.current, editor, runtime);
    }
  };

  useEffect(() => {
    syncChecklists();
  });

  useEffect(() => {
    if (
      !requestedBlockId ||
      !viewRef.current ||
      focusedRequestRef.current === requestedBlockId
    ) {
      return;
    }
    focusedRequestRef.current = requestedBlockId;

    if (
      !getStableBlockIds(editor.document as RitmoBlock[]).has(requestedBlockId)
    ) {
      onRequestedBlockMissing?.(requestedBlockId);
      return;
    }

    let secondFrame: number | undefined;
    const firstFrame = requestAnimationFrame(() => {
      if (!viewRef.current) return;
      const result = focusBlockById(editor, viewRef.current, requestedBlockId);
      if (result === "missing") {
        secondFrame = requestAnimationFrame(() => {
          if (!viewRef.current) return;
          if (
            focusBlockById(editor, viewRef.current, requestedBlockId) ===
            "missing"
          ) {
            onRequestedBlockMissing?.(requestedBlockId);
          }
        });
      }
    });

    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame !== undefined) cancelAnimationFrame(secondFrame);
    };
  }, [editor, onRequestedBlockMissing, requestedBlockId]);

  useEffect(
    () =>
      editor.onBeforeChange(({ getChanges }) => {
        let cursorInsideActivity = false;
        try {
          cursorInsideActivity = isInsideActivity(
            editor,
            editor.getTextCursorPosition().block.id,
          );
        } catch {
          // A multi-block selection has no text cursor to inspect.
        }

        const hasNestedActivity = (block: RitmoBlock): boolean =>
          (block.children as RitmoBlock[]).some(
            (child) => child.type === "activity" || hasNestedActivity(child),
          );

        const wouldNestActivity = getChanges().some((change) => {
          if (change.block.type !== "activity") return false;
          if (hasNestedActivity(change.block as RitmoBlock)) return true;

          if (change.type === "move" && change.currentParent) {
            return isInsideActivity(editor, change.currentParent.id);
          }

          return change.type === "insert" && cursorInsideActivity;
        });

        return wouldNestActivity ? false : undefined;
      }),
    [editor],
  );

  const statusLabel = navigationError
    ? navigationError.message
    : (snapshot.error?.message ?? saveLabels[snapshot.status]);

  return (
    <ActivityRuntimeProvider
      value={{
        ...runtime,
        canUseBlockId: (blockId) => {
          const stableIds = getStableBlockIds(editor.document as RitmoBlock[]);
          return (
            stableIds.has(blockId) && persistedBlockIdsRef.current.has(blockId)
          );
        },
      }}
    >
      <RoutineMetadataEditor
        onChangeIcon={(icon) =>
          controller.track(() => changeIcon(icon), "routine-icon")
        }
        onChangeRecurrence={(recurrence) =>
          controller.track(
            () => changeRecurrence(recurrence),
            "routine-recurrence",
          )
        }
        onRename={(name) =>
          controller.track(() => renameRoutine(name), "routine-name")
        }
        onDraftChange={(key, dirty) => controller.setExternalDirty(key, dirty)}
        routine={routine}
        saveStatus={statusLabel}
      />
      {snapshot.status === "error" && controller.canRetry() ? (
        <button
          className={styles.retryButton}
          onClick={() => void controller.retry().catch(() => undefined)}
          type="button"
        >
          Reintentar guardado
        </button>
      ) : null}
      <div className={styles.editorSurface} ref={viewRef}>
        <BlockNoteView
          editor={editor}
          filePanel={false}
          onChange={() => {
            checklistScopesRef.current = normalizeChecklistScopeTransitions(
              editor,
              checklistScopesRef.current,
            );

            const content = normalizeActivityChecklists(
              editor.document as RitmoBlock[],
            );
            controller.change(content);
            requestAnimationFrame(syncChecklists);
          }}
          onClickCapture={(event) => {
            interceptDailyChecklistClick(event, editor, runtime);
          }}
          slashMenu={false}
          tableHandles={false}
          theme={theme}
        >
          <ActivitySlashMenu editor={editor} />
        </BlockNoteView>
      </div>
    </ActivityRuntimeProvider>
  );
}

export function RoutineEditor(props: RoutineEditorProps) {
  const inspection = inspectDocument(props.routine.content);

  return (
    <main className={styles.editorShell}>
      {inspection.kind === "recovery" ? (
        <RecoveryDocument inspection={inspection} />
      ) : (
        <EditableRoutineDocument {...props} inspection={inspection} />
      )}
    </main>
  );
}
