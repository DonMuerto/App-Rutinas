"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

import { useTimer } from "@/components/timer";
import { CompletionStore } from "@/lib/completions";
import type { CompletionKey, LocalDate, Routine } from "@/lib/contracts";
import { createBrowserRepositories } from "@/lib/repositories/browser";
import type { Repositories } from "@/lib/repositories";
import { repositoryInvalidations } from "@/lib/repositories/query-keys";
import { LocalDateObserver, useObservedLocalDate } from "@/lib/today";

import type { ActivityRuntimeValue } from "./activity-runtime";
import { RoutineEditor } from "./routine-editor";
import styles from "./editor.module.css";

const dateObserver = new LocalDateObserver();

interface EditorRuntime {
  readonly repositories: Repositories;
  readonly completions: CompletionStore;
}

type RuntimeState =
  | { readonly status: "loading" }
  | { readonly status: "error" }
  | { readonly status: "ready"; readonly value: EditorRuntime };

export interface RoutineEditorScreenProps {
  readonly initialRoutine: Routine;
  readonly requestedBlockId?: string;
}

function ConnectedRoutineEditor({
  initialRoutine,
  requestedBlockId,
  runtime,
  localDate,
}: RoutineEditorScreenProps & {
  readonly runtime: EditorRuntime;
  readonly localDate: LocalDate;
}) {
  const timer = useTimer();
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const [routine, setRoutine] = useState(initialRoutine);
  const [announcement, setAnnouncement] = useState("");
  const [, setCompletionRevision] = useState(0);

  useEffect(() => {
    const unsubscribe = runtime.completions.subscribe(() =>
      setCompletionRevision((revision) => revision + 1),
    );
    return () => {
      unsubscribe();
    };
  }, [runtime.completions]);

  const activityRuntime: ActivityRuntimeValue = {
    routineId: routine.id,
    routineName: routine.name,
    localDate,
    isCompleted: (scopeActivityBlockId, blockId) =>
      runtime.completions.getState(
        {
          routineId: routine.id,
          scopeActivityBlockId,
          blockId,
          blockType:
            scopeActivityBlockId === blockId ? "activity" : "checklist",
        },
        localDate,
      ).completed,
    isCompletionPending: (scopeActivityBlockId, blockId) =>
      runtime.completions.getState(
        {
          routineId: routine.id,
          scopeActivityBlockId,
          blockId,
          blockType:
            scopeActivityBlockId === blockId ? "activity" : "checklist",
        },
        localDate,
      ).pending,
    toggleCompletion: async (key: CompletionKey, completed: boolean) => {
      const mutationDate = dateObserver.refresh();
      const target = {
        routineId: key.routineId,
        scopeActivityBlockId: key.scopeActivityBlockId,
        blockId: key.blockId,
        blockType: key.blockType,
      };

      if (
        runtime.completions.getState(target, mutationDate).completed !==
        completed
      ) {
        const persistedState = await runtime.completions.toggle(
          target,
          mutationDate,
        );
        setAnnouncement(runtime.completions.getAnnouncement());
        if (persistedState !== completed) return;
      }

      await repositoryInvalidations.completionChanged(
        queryClient,
        mutationDate,
      );
    },
    startTimer: (request) => {
      const result = timer.start({
        config: request.config,
        origin: {
          activityId: request.activityBlockId,
          activityTitle: request.activityTitle,
          routineId: request.routineId,
          routineName: request.routineName,
        },
      });

      if (!result.ok && result.reason === "occupied") {
        timer.openFocus();
        setAnnouncement(
          "Ya hay un temporizador activo. Abriendo el existente.",
        );
      } else if (!result.ok) {
        setAnnouncement(
          "Corrige la configuracion antes de iniciar el temporizador.",
        );
      } else {
        setAnnouncement(`Temporizador iniciado para ${request.activityTitle}.`);
      }
    },
  };

  return (
    <>
      <RoutineEditor
        changeIcon={async (icon) => {
          await runtime.repositories.routines.updateIcon(routine.id, icon);
          setRoutine((current) => ({ ...current, icon }));
          await repositoryInvalidations.routineIconChanged(
            queryClient,
            routine.id,
          );
        }}
        changeRecurrence={async (recurrence) => {
          await runtime.repositories.routines.updateRecurrence(
            routine.id,
            recurrence,
          );
          setRoutine((current) => ({ ...current, ...recurrence }) as Routine);
          await repositoryInvalidations.routineRecurrenceChanged(
            queryClient,
            routine.id,
          );
        }}
        onRequestedBlockMissing={() =>
          setAnnouncement("La actividad cambio o fue eliminada.")
        }
        renameRoutine={async (name) => {
          await runtime.repositories.routines.rename(routine.id, name);
          setRoutine((current) => ({ ...current, name }));
          await repositoryInvalidations.routineRenamed(queryClient, routine.id);
        }}
        requestedBlockId={requestedBlockId}
        routine={routine}
        runtime={activityRuntime}
        saveDocument={async (content) => {
          await runtime.repositories.routines.saveDocument(routine.id, content);
          await repositoryInvalidations.routineDocumentSaved(
            queryClient,
            routine.id,
          );
        }}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
      />
      <p aria-live="polite" className={styles.visuallyHidden} role="status">
        {announcement}
      </p>
    </>
  );
}

export function RoutineEditorScreen({
  initialRoutine,
  requestedBlockId,
}: RoutineEditorScreenProps) {
  const [request, setRequest] = useState(0);
  const [runtime, setRuntime] = useState<RuntimeState>({ status: "loading" });
  const [hydratedDate, setHydratedDate] = useState<LocalDate>();
  const hydratedDateRef = useRef<LocalDate | undefined>(undefined);
  const [hydrationWarning, setHydrationWarning] = useState("");
  const localDate = useObservedLocalDate(dateObserver);

  useEffect(() => {
    let active = true;

    createBrowserRepositories().then(
      (repositories) => {
        if (!active) return;
        setRuntime({
          status: "ready",
          value: {
            repositories,
            completions: new CompletionStore(repositories.completions),
          },
        });
      },
      () => {
        if (active) setRuntime({ status: "error" });
      },
    );

    return () => {
      active = false;
    };
  }, [request]);

  useEffect(() => {
    if (runtime.status !== "ready" || !localDate) return;
    let active = true;
    const startedAtRevision = runtime.value.completions.getRevision();

    runtime.value.repositories.completions
      .list([initialRoutine.id], localDate)
      .then(
        (completions) => {
          if (!active) return;
          runtime.value.completions.hydrate(
            localDate,
            completions.map((completion) => ({
              target: {
                routineId: completion.routineId,
                scopeActivityBlockId: completion.scopeActivityBlockId,
                blockId: completion.blockId,
                blockType: completion.blockType,
              },
              completed: true,
            })),
            startedAtRevision,
          );
          setHydrationWarning("");
          hydratedDateRef.current = localDate;
          setHydratedDate(localDate);
        },
        () => {
          if (!active) return;
          if (hydratedDateRef.current) {
            setHydrationWarning(
              "No pudimos actualizar los completados para la nueva fecha. El documento sigue disponible.",
            );
          } else {
            setRuntime({ status: "error" });
          }
        },
      );

    return () => {
      active = false;
    };
  }, [initialRoutine.id, localDate, runtime]);

  if (runtime.status === "error") {
    return (
      <main className={styles.editorShell}>
        <section role="alert">
          <h1>No pudimos abrir la rutina</h1>
          <p>Revisa tu sesion o conexion e intenta nuevamente.</p>
          <button
            onClick={() => {
              setRuntime({ status: "loading" });
              hydratedDateRef.current = undefined;
              setHydratedDate(undefined);
              setHydrationWarning("");
              setRequest((value) => value + 1);
            }}
            type="button"
          >
            Reintentar
          </button>
        </section>
      </main>
    );
  }

  if (runtime.status === "loading" || !localDate || !hydratedDate) {
    return (
      <main className={styles.editorShell}>
        <p aria-busy="true">Cargando rutina...</p>
      </main>
    );
  }

  return (
    <>
      <ConnectedRoutineEditor
        initialRoutine={initialRoutine}
        key={initialRoutine.id}
        localDate={localDate}
        requestedBlockId={requestedBlockId}
        runtime={runtime.value}
      />
      {hydrationWarning ? <p role="alert">{hydrationWarning}</p> : null}
    </>
  );
}
