import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { LocalDate, Routine } from "@ritmo/core";
import {
  getChecklistActivityScopes,
  getStableBlockIds,
  inspectDocument,
  serializeDocument,
  type DocumentBlock,
  type DocumentInspection,
} from "@ritmo/document-model";

import type { DraftController, DraftRef } from "../draft-controller";
import { ActivityRuntimeProvider } from "./activity-runtime";
import type { EditorCompletionPort, EditorTimerPort } from "./activity-runtime";
import { ActivitySlashMenu } from "./activity-slash-menu";
import { isInsideActivity } from "./activity-scope";
import {
  ritmoSchema,
  type RitmoBlock,
  type RitmoPartialBlock,
} from "./activity-schema";
import {
  applyDailyChecklistState,
  interceptDailyChecklistClick,
  normalizeChecklistScopeTransitions,
  toDocumentBlocks,
} from "./checklist-completions";
import styles from "./editor.module.css";
import { focusBlockById } from "./focus-block";
import { RoutineMetadataEditor } from "./routine-metadata";

export interface RoutineEditorProps {
  routine: Routine;
  localDate: LocalDate;
  draftController: DraftController;
  completions: EditorCompletionPort;
  timer?: EditorTimerPort;
  requestedBlockId?: string;
  theme?: "light" | "dark";
  onRename(name: string): Promise<void>;
  onChangeIcon(icon: string | null): Promise<void>;
  onChangeRecurrence(
    recurrence: Pick<Routine, "recurrenceType" | "specificDate">,
  ): Promise<void>;
  onConflict?(draft: DraftRef): void;
  onRequestedBlockMissing?(blockId: string): void;
  announce?(message: string): void;
}

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
  inspection: Extract<DocumentInspection, { kind: "recovery" }>;
}) {
  return (
    <section aria-labelledby="recovery-title" className={styles.recovery}>
      <h2 id="recovery-title">Documento en recuperacion</h2>
      <p>
        El documento contiene datos que BlockNote no puede montar sin riesgo. Se
        conserva en modo de solo lectura y no se guardara automaticamente.
      </p>
      <ul>
        {inspection.diagnostics.map((item, index) => (
          <li key={`${item.code}-${index}`}>{item.message}</li>
        ))}
      </ul>
      <details>
        <summary>Ver JSON conservado</summary>
        <pre>{safeJson(inspection.original)}</pre>
      </details>
    </section>
  );
}

function EditableRoutine({
  props,
  inspection,
  remoteStableIds,
}: {
  props: RoutineEditorProps;
  inspection: Extract<DocumentInspection, { kind: "editable" }>;
  remoteStableIds: ReadonlySet<string>;
}) {
  const {
    routine,
    localDate,
    draftController,
    completions,
    timer,
    requestedBlockId,
    theme,
    onRename,
    onChangeIcon,
    onChangeRecurrence,
    onConflict,
    onRequestedBlockMissing,
    announce = () => undefined,
  } = props;
  const viewRef = useRef<HTMLDivElement>(null);
  const focusedRequestRef = useRef<string | undefined>(undefined);
  const reportedConflictRef = useRef<number | undefined>(undefined);
  const editor = useCreateBlockNote(
    {
      schema: ritmoSchema,
      initialContent: inspection.initialBlocks as RitmoPartialBlock[],
      tabBehavior: "prefer-indent",
    },
    [routine.id],
  );
  const checklistScopesRef = useRef(
    getChecklistActivityScopes(editor.document as unknown as DocumentBlock[]),
  );
  const snapshot = useSyncExternalStore(
    draftController.subscribe,
    draftController.getSnapshot,
    draftController.getSnapshot,
  );
  const currentDraft = snapshot.drafts.find(
    (draft) => draft.routineId === routine.id,
  );
  const documentConflict = currentDraft?.phase === "conflict";
  const status = currentDraft
    ? currentDraft.phase === "storage-error"
      ? "Draft local en estado critico. No salgas del documento."
      : currentDraft.phase === "remote-error"
        ? "Sin conexion. El draft local esta protegido."
        : currentDraft.phase === "conflict"
          ? "Conflicto remoto. El draft local se conserva."
          : currentDraft.phase === "saving"
            ? "Guardando..."
            : currentDraft.phase === "persisting"
              ? "Protegiendo draft local..."
              : "Cambios pendientes"
    : "Guardado";

  const runtime = {
    routineId: routine.id,
    routineName: routine.name,
    localDate,
    completions,
    timer,
    canUseBlockId(blockId: string) {
      if (documentConflict) return false;
      const currentStableIds = getStableBlockIds(
        editor.document as unknown as DocumentBlock[],
      );
      return (
        currentStableIds.has(blockId) &&
        (remoteStableIds.has(blockId) || currentDraft === undefined)
      );
    },
    announce,
  };

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
      currentDraft?.phase === "conflict" &&
      reportedConflictRef.current !== currentDraft.generation
    ) {
      reportedConflictRef.current = currentDraft.generation;
      onConflict?.({
        routineId: routine.id,
        generation: currentDraft.generation,
      });
    }
  }, [currentDraft, onConflict, routine.id]);

  useEffect(() => {
    if (
      !requestedBlockId ||
      !viewRef.current ||
      focusedRequestRef.current === requestedBlockId
    ) {
      return;
    }
    focusedRequestRef.current = requestedBlockId;
    let secondFrame: number | undefined;
    const firstFrame = requestAnimationFrame(() => {
      if (!viewRef.current) return;
      if (
        focusBlockById(editor, viewRef.current, requestedBlockId) === "missing"
      ) {
        secondFrame = requestAnimationFrame(() => {
          if (
            viewRef.current &&
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
      editor.onBeforeChange((context) => {
        let cursorInsideActivity = false;
        try {
          cursorInsideActivity = isInsideActivity(
            editor,
            editor.getTextCursorPosition().block.id,
          );
        } catch {
          // Multi-block selections do not expose a text cursor.
        }
        const hasActivityDescendant = (block: RitmoBlock): boolean =>
          (block.children as RitmoBlock[]).some(
            (child) =>
              child.type === "activity" || hasActivityDescendant(child),
          );
        const invalid = context.getChanges().some((change) => {
          const block = change.block as RitmoBlock;
          const hasNestedActivity = hasActivityDescendant(block);
          const containsActivity =
            block.type === "activity" || hasNestedActivity;
          if (!containsActivity) return false;
          if (block.type === "activity" && hasNestedActivity) return true;
          if (change.type === "move" && change.currentParent) {
            return isInsideActivity(editor, change.currentParent.id);
          }
          return change.type === "insert" && cursorInsideActivity;
        });
        return invalid ? false : undefined;
      }),
    [editor],
  );

  return (
    <ActivityRuntimeProvider value={runtime}>
      <RoutineMetadataEditor
        onChangeIcon={onChangeIcon}
        onChangeRecurrence={onChangeRecurrence}
        onRename={onRename}
        routine={routine}
        saveStatus={status}
      />
      <div className={styles.editorSurface} ref={viewRef}>
        <BlockNoteView
          editable={!documentConflict}
          editor={editor}
          filePanel={false}
          onChange={() => {
            checklistScopesRef.current = normalizeChecklistScopeTransitions(
              editor,
              checklistScopesRef.current,
            );
            const document = serializeDocument(
              toDocumentBlocks(editor.document),
            );
            void draftController
              .recordChange({
                routineId: routine.id,
                document,
                baseRevision: routine.revision,
                localDate,
              })
              .catch(() =>
                announce(
                  "No pudimos proteger el draft local. No salgas del documento.",
                ),
              );
            requestAnimationFrame(syncChecklists);
          }}
          onClickCapture={(event) =>
            interceptDailyChecklistClick(event, editor, runtime)
          }
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
  const { routine, draftController, onConflict } = props;
  const onConflictRef = useRef(onConflict);
  const [loaded, setLoaded] = useState<{
    routineId: string;
    document?: Routine["content"];
    error?: string;
  }>();

  useEffect(() => {
    onConflictRef.current = onConflict;
  }, [onConflict]);

  useEffect(() => {
    let active = true;
    void draftController
      .initialize()
      .then(() =>
        draftController.restore({
          routineId: routine.id,
          document: routine.content,
          revision: routine.revision,
        }),
      )
      .then(
        (result) => {
          if (!active) return;
          if (result.kind === "conflict") {
            onConflictRef.current?.(result.draft);
            setLoaded({
              routineId: routine.id,
              document: result.remote.document,
            });
          } else {
            setLoaded({
              routineId: routine.id,
              document: result.document.document,
            });
          }
        },
        (error: unknown) => {
          if (active) {
            setLoaded({
              routineId: routine.id,
              error:
                error instanceof Error
                  ? error.message
                  : "No pudimos restaurar el documento.",
            });
          }
        },
      );
    return () => {
      active = false;
    };
  }, [draftController, routine.content, routine.id, routine.revision]);

  const current = loaded?.routineId === routine.id ? loaded : undefined;
  if (current?.error) {
    return <section role="alert">{current.error}</section>;
  }
  if (!current?.document) {
    return <p aria-busy="true">Cargando documento...</p>;
  }

  const inspection = inspectDocument(current.document);
  const remoteInspection = inspectDocument(routine.content);
  const remoteStableIds =
    remoteInspection.kind === "editable"
      ? remoteInspection.stableBlockIds
      : new Set<string>();

  return (
    <main className={styles.editorShell}>
      {inspection.kind === "recovery" ? (
        <RecoveryDocument inspection={inspection} />
      ) : (
        <EditableRoutine
          key={routine.id}
          inspection={inspection}
          props={props}
          remoteStableIds={remoteStableIds}
        />
      )}
    </main>
  );
}
