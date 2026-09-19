import { useEffect, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import type { LocalDate } from "@ritmo/core";
import type { NavigationPort } from "@ritmo/platform";
import { Button, Icon } from "@ritmo/ui";

import type {
  TodayActivity,
  TodayDataSource,
  TodayReadModel,
  TimerControllerPort,
} from "../contracts";
import {
  useCompletionAnnouncement,
  useCompletionState,
  useCompletionStore,
} from "../completions/completion-provider";
import type {
  CompletionSnapshot,
  CompletionTarget,
} from "../completions/completion-store";
import type { LocalDateObserver } from "../dates/local-date-observer";
import { useObservedLocalDate } from "../dates/use-local-date";
import { sortTodayActivities } from "./order";

const IDLE_TIMER = Object.freeze({ status: "idle" as const });

function collectCompletions(model: TodayReadModel) {
  const completions: CompletionSnapshot[] = [];
  for (const activity of model.activities) {
    if (!activity.activityBlockId || !activity.canComplete) continue;
    completions.push({
      target: {
        routineId: activity.routineId,
        scopeActivityBlockId: activity.activityBlockId,
        blockId: activity.activityBlockId,
        blockType: "activity",
      },
      completed: activity.completed,
    });

    for (const subtask of activity.subtasks) {
      if (!subtask.blockId || !subtask.canComplete) continue;
      completions.push({
        target: {
          routineId: activity.routineId,
          scopeActivityBlockId: activity.activityBlockId,
          blockId: subtask.blockId,
          blockType: "checklist",
        },
        completed: subtask.completed,
      });
    }
  }
  return completions;
}

function formatLocalDate(date: LocalDate) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(year, month - 1, day, 12));
}

function CompletionControl({
  date,
  label,
  observer,
  target,
  userId,
}: {
  readonly date: LocalDate;
  readonly label: string;
  readonly observer: LocalDateObserver;
  readonly target: CompletionTarget;
  readonly userId: string;
}) {
  const store = useCompletionStore();
  const state = useCompletionState(userId, target, date);
  const action = state.completed ? "Desmarcar" : "Marcar";

  return (
    <label className="completion-control">
      <input
        aria-busy={state.pending}
        aria-label={`${action} ${label} como completada`}
        checked={state.completed}
        disabled={state.pending}
        onChange={() => {
          const mutationDate = observer.refresh();
          void store.toggle(userId, target, mutationDate);
        }}
        type="checkbox"
      />
      {state.pending ? <span>Guardando...</span> : null}
    </label>
  );
}

function TimerAction({
  activity,
  announce,
  timer,
}: {
  readonly activity: TodayActivity;
  readonly announce: (message: string) => void;
  readonly timer: TimerControllerPort;
}) {
  const [starting, setStarting] = useState(false);
  const snapshot = useSyncExternalStore(
    timer.subscribe,
    timer.getSnapshot,
    () => IDLE_TIMER,
  );

  if (activity.timer.status === "none") return null;
  if (activity.timer.status === "invalid" || !activity.activityBlockId) {
    return (
      <Button disabled compact title="Corrige esta Activity en su documento.">
        Timer no disponible
      </Button>
    );
  }

  const activityId = activity.activityBlockId;
  const config = activity.timer.config;
  const title = activity.title.trim() || "Actividad sin titulo";

  async function handleTimer() {
    if (snapshot.status !== "idle") {
      timer.openFocus();
      announce("Abriendo el temporizador activo.");
      return;
    }

    setStarting(true);
    try {
      const result = await timer.start({
        config,
        origin: {
          activityId,
          activityTitle: title,
          routineId: activity.routineId,
          routineName: activity.routineName,
        },
      });
      announce(
        result.ok
          ? `Temporizador iniciado para ${title}.`
          : "No se pudo iniciar el temporizador. Revisa el timer activo e intenta nuevamente.",
      );
    } finally {
      setStarting(false);
    }
  }

  return (
    <Button
      compact
      disabled={starting}
      onClick={() => void handleTimer()}
      variant="primary"
    >
      <Icon height="17" name="timer" width="17" />
      {starting
        ? "Iniciando..."
        : snapshot.status === "idle"
          ? "Iniciar timer"
          : "Abrir timer"}
    </Button>
  );
}

function ActivityRow({
  activity,
  date,
  navigation,
  observer,
  timer,
  userId,
  announceTimer,
}: {
  readonly activity: TodayActivity;
  readonly date: LocalDate;
  readonly navigation: NavigationPort;
  readonly observer: LocalDateObserver;
  readonly timer: TimerControllerPort;
  readonly userId: string;
  readonly announceTimer: (message: string) => void;
}) {
  const title = activity.title.trim() || "Actividad sin titulo";
  const activityTarget: CompletionTarget | null = activity.activityBlockId
    ? {
        routineId: activity.routineId,
        scopeActivityBlockId: activity.activityBlockId,
        blockId: activity.activityBlockId,
        blockType: "activity",
      }
    : null;
  const headingId = `today-${activity.routineId}-${activity.activityBlockId ?? activity.documentOrder}`;
  const origin = activity.origin;

  return (
    <li className="today-activity">
      <article aria-labelledby={headingId}>
        <div className="today-activity-main">
          {activityTarget && activity.canComplete ? (
            <CompletionControl
              date={date}
              label={title}
              observer={observer}
              target={activityTarget}
              userId={userId}
            />
          ) : (
            <span className="today-unavailable">Estado no disponible</span>
          )}
          <div className="today-activity-copy">
            <div className="today-activity-heading">
              <h2 id={headingId}>{title}</h2>
              {activity.scheduledTime ? (
                <time dateTime={activity.scheduledTime}>
                  {activity.scheduledTime}
                </time>
              ) : (
                <span>Sin hora</span>
              )}
            </div>
            <p>
              {activity.routineIcon ? (
                <span aria-hidden="true">{activity.routineIcon} </span>
              ) : null}
              {activity.routineName}
            </p>
          </div>
          <div className="today-actions">
            <TimerAction
              activity={activity}
              announce={announceTimer}
              timer={timer}
            />
            {origin ? (
              <Button
                compact
                onClick={() =>
                  navigation.push(
                    `/rutinas/${encodeURIComponent(origin.routineId)}?activity=${encodeURIComponent(origin.activityBlockId)}`,
                  )
                }
                variant="quiet"
              >
                Abrir origen
              </Button>
            ) : (
              <span className="today-unavailable">Origen no disponible</span>
            )}
          </div>
        </div>

        {activity.subtasks.length > 0 ? (
          <ul aria-label={`Subtareas de ${title}`} className="today-subtasks">
            {activity.subtasks.map((subtask, index) => {
              const subtaskTitle =
                subtask.title.trim() || "Subtarea sin titulo";
              const target =
                activity.activityBlockId && subtask.blockId
                  ? {
                      routineId: activity.routineId,
                      scopeActivityBlockId: activity.activityBlockId,
                      blockId: subtask.blockId,
                      blockType: "checklist" as const,
                    }
                  : null;
              return (
                <li
                  key={subtask.blockId ?? `missing-${index}`}
                  style={{
                    marginInlineStart: `${Math.max(0, subtask.relativeDepth - 1)}rem`,
                  }}
                >
                  {target && subtask.canComplete ? (
                    <CompletionControl
                      date={date}
                      label={subtaskTitle}
                      observer={observer}
                      target={target}
                      userId={userId}
                    />
                  ) : (
                    <span className="today-unavailable">
                      Estado no disponible
                    </span>
                  )}
                  <span>{subtaskTitle}</span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </article>
    </li>
  );
}

export function TodayView({
  dataSource,
  dateObserver,
  navigation,
  timer,
  userId,
}: {
  readonly dataSource: TodayDataSource;
  readonly dateObserver: LocalDateObserver;
  readonly navigation: NavigationPort;
  readonly timer: TimerControllerPort;
  readonly userId: string;
}) {
  const date = useObservedLocalDate(dateObserver);
  const store = useCompletionStore();
  const announcement = useCompletionAnnouncement(userId);
  const [timerAnnouncement, setTimerAnnouncement] = useState("");
  const query = useQuery({
    enabled: date !== null,
    queryKey: ["user", userId, "routines", "today", date],
    queryFn: async ({ signal }) => {
      if (!date) throw new Error("La fecha local aun no esta disponible.");
      const revision = store.getRevision(userId);
      const model = await dataSource.load({ userId, localDate: date, signal });
      store.hydrate(userId, date, collectCompletions(model), revision);
      return model;
    },
  });
  const refetch = query.refetch;

  useEffect(
    () => dateObserver.subscribeResume(() => void refetch()),
    [dateObserver, refetch],
  );

  return (
    <main className="today-page" id="main-content">
      <header className="today-header">
        <div>
          <h1>Hoy</h1>
          {date ? (
            <time dateTime={date}>{formatLocalDate(date)}</time>
          ) : (
            <span>Calculando fecha local...</span>
          )}
        </div>
        <p>Lo que merece tu atencion, en el orden del dia.</p>
      </header>

      <p aria-atomic="true" aria-live="assertive" className="visually-hidden">
        {announcement}
      </p>
      <p aria-atomic="true" aria-live="polite" className="visually-hidden">
        {timerAnnouncement}
      </p>

      {query.isPending ? (
        <section
          aria-busy="true"
          aria-label="Cargando actividades"
          className="today-loading"
        >
          <span />
          <span />
          <span />
        </section>
      ) : null}

      {query.isError ? (
        <section className="today-message" role="alert">
          <Icon height="24" name="warning" width="24" />
          <h2>No pudimos cargar Hoy</h2>
          <p>Revisa tu conexion e intenta nuevamente.</p>
          <Button onClick={() => void query.refetch()} variant="secondary">
            Reintentar
          </Button>
        </section>
      ) : null}

      {query.data && date ? (
        <>
          {query.data.diagnostics.length > 0 ? (
            <p className="today-diagnostic" role="status">
              Algunas actividades tienen datos invalidos. Abre su origen para
              corregirlas.
            </p>
          ) : null}
          {query.data.activities.length === 0 ? (
            <section className="today-message">
              <Icon height="26" name="check" width="26" />
              <h2>El dia esta despejado</h2>
              <p>No hay actividades aplicables para esta fecha.</p>
            </section>
          ) : (
            <ol aria-label="Actividades de hoy" className="today-list">
              {sortTodayActivities(query.data.activities).map((activity) => (
                <ActivityRow
                  activity={activity}
                  announceTimer={setTimerAnnouncement}
                  date={date}
                  key={`${activity.routineId}:${activity.activityBlockId ?? activity.documentOrder}`}
                  navigation={navigation}
                  observer={dateObserver}
                  timer={timer}
                  userId={userId}
                />
              ))}
            </ol>
          )}
        </>
      ) : null}
    </main>
  );
}
