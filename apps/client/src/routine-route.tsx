import { useEffect, useState, useSyncExternalStore } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { CompletionKey } from "@ritmo/core";
import {
  completionKeys,
  repositoryInvalidations,
  routineKeys,
  type AuthUser,
  type DataAuthServices,
} from "@ritmo/data-auth";
import { projectActivities } from "@ritmo/document-model";
import type { CompletionSnapshot, CompletionTarget } from "@ritmo/features";
import { useObservedLocalDate } from "@ritmo/features";
import type { DraftRef } from "@ritmo/editor";
import { RoutineEditor } from "@ritmo/editor/react";
import { Button, useTheme } from "@ritmo/ui";

import type { PrivateResources } from "./private-app";

function targetFromKey(key: CompletionKey): CompletionTarget {
  return {
    routineId: key.routineId,
    scopeActivityBlockId: key.scopeActivityBlockId,
    blockId: key.blockId,
    blockType: key.blockType,
  };
}

function RoutineRoute({
  resources,
  services,
  user,
}: {
  readonly resources: PrivateResources;
  readonly services: DataAuthServices;
  readonly user: AuthUser;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { routineId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const { resolvedTheme } = useTheme();
  const localDate = useObservedLocalDate(resources.dateObserver);
  const [announcement, setAnnouncement] = useState("");
  const [conflict, setConflict] = useState<DraftRef | null>(null);
  const [editorEpoch, setEditorEpoch] = useState(0);
  const [resolvingConflict, setResolvingConflict] = useState(false);
  const routines = services.repositories.routines;
  const activeConflict = conflict?.routineId === routineId ? conflict : null;
  const routine = useQuery({
    enabled: routineId !== "",
    queryKey: routineKeys.detail(user.id, routineId),
    queryFn: () => routines.getById(routineId),
  });
  const completionRevision = useSyncExternalStore(
    resources.completions.subscribe,
    () => resources.completions.getRevision(user.id),
    () => 0,
  );
  void completionRevision;
  const completions = useQuery({
    enabled: Boolean(routine.data && localDate),
    queryKey: completionKeys.forDate(
      user.id,
      localDate ?? "1970-01-01",
      routine.data ? [routine.data.id] : [],
    ),
    async queryFn() {
      if (!routine.data || !localDate) {
        throw new Error("La rutina y la fecha deben estar disponibles.");
      }
      const startedAtRevision = resources.completions.getRevision(user.id);
      const rows = await services.repositories.completions.list(
        [routine.data.id],
        localDate,
      );
      return { rows, startedAtRevision };
    },
  });

  useEffect(() => {
    if (!routine.data || !localDate || !completions.data) return;
    const projected = projectActivities({
      routine: routine.data,
      completionDate: localDate,
      completions: completions.data.rows,
    });
    const snapshots: CompletionSnapshot[] = projected.activities.flatMap(
      (activity) => {
        if (!activity.activityBlockId) return [];
        const activitySnapshot: CompletionSnapshot = {
          target: {
            routineId: activity.routineId,
            scopeActivityBlockId: activity.activityBlockId,
            blockId: activity.activityBlockId,
            blockType: "activity",
          },
          completed: activity.completed,
        };
        return [
          activitySnapshot,
          ...activity.subtasks.flatMap((subtask): CompletionSnapshot[] =>
            subtask.blockId
              ? [
                  {
                    target: {
                      routineId: activity.routineId,
                      scopeActivityBlockId: activity.activityBlockId!,
                      blockId: subtask.blockId,
                      blockType: "checklist",
                    },
                    completed: subtask.completed,
                  },
                ]
              : [],
          ),
        ];
      },
    );
    resources.completions.hydrate(
      user.id,
      localDate,
      snapshots,
      completions.data.startedAtRevision,
    );
  }, [
    completions.data,
    localDate,
    resources.completions,
    routine.data,
    user.id,
  ]);

  if (routine.isPending || !localDate) {
    return (
      <main aria-busy="true" className="app-state" id="main-content">
        Cargando documento...
      </main>
    );
  }
  if (routine.isError || !routine.data) {
    return (
      <main className="app-state" id="main-content" role="alert">
        <h1>No pudimos abrir esta rutina</h1>
        <p>Puede que haya sido eliminada o que no tengas acceso.</p>
        <Button onClick={() => void routine.refetch()}>Reintentar</Button>
      </main>
    );
  }

  const currentRoutine = routine.data;
  const editorCompletions = {
    getState(key: CompletionKey) {
      return resources.completions.getState(
        user.id,
        targetFromKey(key),
        key.completionDate,
      );
    },
    async setCompleted(key: CompletionKey, completed: boolean) {
      const target = targetFromKey(key);
      const current = resources.completions.getState(
        user.id,
        target,
        key.completionDate,
      );
      if (current.completed !== completed) {
        await resources.completions.toggle(user.id, target, key.completionDate);
      }
    },
  };
  const editorTimer = {
    async start(request: {
      origin: {
        routineId: string;
        routineName: string;
        activityBlockId: string;
        activityTitle: string;
      };
      config: Parameters<PrivateResources["timer"]["start"]>[0]["config"];
    }) {
      const result = await resources.timer.start({
        config: request.config,
        origin: {
          routineId: request.origin.routineId,
          routineName: request.origin.routineName,
          activityId: request.origin.activityBlockId,
          activityTitle: request.origin.activityTitle,
        },
      });
      return result.ok
        ? ({ ok: true } as const)
        : ({
            ok: false,
            reason: result.reason === "occupied" ? "occupied" : "invalid",
          } as const);
    },
    openFocus() {
      resources.timer.openFocus();
    },
  };

  async function resolveByDiscard() {
    if (!activeConflict) return;
    setResolvingConflict(true);
    try {
      const result = await resources.drafts.discard({
        ...activeConflict,
        confirmed: true,
      });
      if (result !== "discarded") {
        setAnnouncement("El draft cambio. Revisa el conflicto nuevamente.");
        return;
      }
      setConflict(null);
      await routine.refetch();
      setEditorEpoch((value) => value + 1);
      setAnnouncement("Cargamos la version remota.");
    } finally {
      setResolvingConflict(false);
    }
  }

  async function resolveByCopy() {
    if (!activeConflict) return;
    setResolvingConflict(true);
    try {
      const result = await resources.drafts.saveConflictAsNew({
        draft: activeConflict,
        metadata: {
          name: `${currentRoutine.name} (copia recuperada)`,
          icon: currentRoutine.icon,
          recurrenceType: currentRoutine.recurrenceType,
          specificDate: currentRoutine.specificDate,
        },
      });
      if (result.kind === "created") {
        await repositoryInvalidations.routineCreated(queryClient, user.id);
        navigate(`/rutinas/${encodeURIComponent(result.routine.routineId)}`);
        return;
      }
      setAnnouncement("No pudimos guardar la copia. El draft sigue protegido.");
    } finally {
      setResolvingConflict(false);
    }
  }

  return (
    <>
      {activeConflict ? (
        <section className="conflict-banner" role="alert">
          <div>
            <strong>Este documento cambio en otro contexto.</strong>
            <p>
              El draft local esta protegido y el editor queda en solo lectura.
            </p>
          </div>
          <div>
            <Button
              disabled={resolvingConflict}
              onClick={() => void resolveByCopy()}
              variant="primary"
            >
              Guardar draft como copia
            </Button>
            <Button
              disabled={resolvingConflict}
              onClick={() => void resolveByDiscard()}
              variant="danger"
            >
              Descartar y cargar remoto
            </Button>
          </div>
        </section>
      ) : null}
      <div id="main-content">
        <RoutineEditor
          announce={setAnnouncement}
          completions={editorCompletions}
          draftController={resources.drafts}
          key={`${currentRoutine.id}:${editorEpoch}`}
          localDate={localDate}
          onChangeIcon={async (icon) => {
            await routines.updateIcon(currentRoutine.id, icon);
            await repositoryInvalidations.routineMetadataChanged(
              queryClient,
              user.id,
              currentRoutine.id,
            );
          }}
          onChangeRecurrence={async (recurrence) => {
            await routines.updateRecurrence(currentRoutine.id, recurrence);
            await repositoryInvalidations.routineMetadataChanged(
              queryClient,
              user.id,
              currentRoutine.id,
            );
          }}
          onConflict={setConflict}
          onRename={async (name) => {
            await routines.rename(currentRoutine.id, name);
            await repositoryInvalidations.routineMetadataChanged(
              queryClient,
              user.id,
              currentRoutine.id,
            );
          }}
          onRequestedBlockMissing={() =>
            setAnnouncement("La Activity cambio o fue eliminada.")
          }
          requestedBlockId={searchParams.get("activity") ?? undefined}
          routine={currentRoutine}
          theme={resolvedTheme}
          timer={editorTimer}
        />
      </div>
      <div aria-live="polite" className="visually-hidden" role="status">
        {announcement}
      </div>
    </>
  );
}

export default RoutineRoute;
