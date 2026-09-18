"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useTimer, type TimerController } from "@/components/timer";

import type { LocalDate } from "@/lib/contracts";
import {
  CompletionProvider,
  useCompletionAnnouncement,
  useCompletionCache,
  useCompletionState,
  type CompletionSnapshot,
  type DailyCompletionCache,
} from "@/lib/completions";
import {
  sortTodayActivities,
  useObservedLocalDate,
  type LocalDateObserver,
  type OriginHrefBuilder,
  type TodayActivity,
  type TodayDataSource,
  type TodayReadModel,
} from "@/lib/today";

interface TodayViewProps {
  source: TodayDataSource;
  completionCache: DailyCompletionCache;
  dateObserver: LocalDateObserver;
  getOriginHref: OriginHrefBuilder;
}

type QueryState =
  | {
      date: LocalDate;
      request: number;
      status: "loaded";
      model: TodayReadModel;
    }
  | { date: LocalDate; request: number; status: "error" };

function collectCompletions(model: TodayReadModel) {
  const completions: CompletionSnapshot[] = [];

  for (const activity of model.activities) {
    if (activity.canComplete && activity.activityBlockId) {
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
        if (subtask.canComplete && subtask.blockId) {
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
    }
  }

  return completions;
}

function useTodayData(
  source: TodayDataSource,
  completionCache: DailyCompletionCache,
  date: LocalDate | null,
) {
  const [query, setQuery] = useState<QueryState | null>(null);
  const [request, setRequest] = useState(0);

  useEffect(() => {
    if (!date) return;

    const controller = new AbortController();
    const hydrationRevision = completionCache.getRevision();

    source.load(date, controller.signal).then(
      (model) => {
        if (controller.signal.aborted) return;
        completionCache.hydrate(
          date,
          collectCompletions(model),
          hydrationRevision,
        );
        setQuery({ date, request, status: "loaded", model });
      },
      (error: unknown) => {
        if (
          !controller.signal.aborted &&
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          setQuery({ date, request, status: "error" });
        }
      },
    );

    return () => controller.abort();
  }, [completionCache, date, request, source]);

  if (!date || query?.date !== date || query.request !== request) {
    return {
      query: { status: "loading" } as const,
      retry: () => setRequest((current) => current + 1),
    };
  }

  return {
    query,
    retry: () => setRequest((current) => current + 1),
  };
}

function formatLocalDate(date: LocalDate) {
  const [year, month, day] = date.split("-").map(Number);
  const civilDate = new Date(year, month - 1, day, 12);

  return new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(civilDate);
}

function CompletionControl({
  completion,
  date,
  dateObserver,
  label,
}: {
  completion: CompletionSnapshot;
  date: LocalDate;
  dateObserver: LocalDateObserver;
  label: string;
}) {
  const cache = useCompletionCache();
  const state = useCompletionState(completion.target, date);

  function handleChange() {
    const mutationDate = dateObserver.refresh();
    void cache.toggle(completion.target, mutationDate);
  }

  return (
    <span className="flex shrink-0 items-center gap-2">
      <input
        type="checkbox"
        checked={state.completed}
        disabled={state.pending}
        aria-label={`${state.completed ? "Desmarcar" : "Marcar"} ${label} como completada`}
        aria-busy={state.pending}
        onChange={handleChange}
        className="size-5 accent-amber-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
      />
      {state.pending ? (
        <span className="text-xs text-neutral-500">Guardando...</span>
      ) : null}
    </span>
  );
}

function TimerAction({
  activity,
  timer,
  announce,
}: {
  activity: TodayActivity;
  timer: TimerController;
  announce(message: string): void;
}) {
  if (activity.timer.status === "none") {
    return null;
  }

  if (activity.timer.status === "invalid") {
    return (
      <button
        type="button"
        disabled
        title="La configuracion del timer necesita correccion."
        className="cursor-not-allowed rounded-full border border-neutral-300 px-3 py-1.5 text-sm text-neutral-500 dark:border-neutral-700"
      >
        Timer no disponible
      </button>
    );
  }

  if (!activity.activityBlockId) {
    return (
      <button
        type="button"
        disabled
        title="La actividad no tiene un ID estable."
        className="cursor-not-allowed rounded-full border border-neutral-300 px-3 py-1.5 text-sm text-neutral-500 dark:border-neutral-700"
      >
        Timer no disponible
      </button>
    );
  }

  const activityBlockId = activity.activityBlockId;
  const timerConfig = activity.timer.config;

  function handleTimer() {
    if (timer.timer.status !== "idle") {
      timer.openFocus();
      announce("Abriendo el temporizador activo.");
      return;
    }

    const title = activity.title.trim() || "Actividad sin titulo";
    const result = timer.start({
      config: timerConfig,
      origin: {
        activityId: activityBlockId,
        activityTitle: title,
        routineId: activity.routineId,
        routineName: activity.routineName,
      },
    });

    if (!result.ok && result.reason === "occupied") {
      announce(
        "Ya hay un temporizador activo. Puedes abrirlo desde esta fila.",
      );
    } else if (!result.ok) {
      announce(
        "No se puede iniciar este temporizador hasta corregir su configuracion.",
      );
    } else {
      announce(`Temporizador iniciado para ${title}.`);
    }
  }

  return (
    <button
      type="button"
      onClick={handleTimer}
      className="rounded-full bg-amber-500 px-3 py-1.5 text-sm font-semibold text-neutral-950 hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
    >
      {timer.timer.status !== "idle" ? "Abrir timer" : "Iniciar timer"}
    </button>
  );
}

function ActivityRow({
  activity,
  date,
  dateObserver,
  timer,
  getOriginHref,
  announceTimer,
}: {
  activity: TodayActivity;
  date: LocalDate;
  dateObserver: LocalDateObserver;
  timer: TimerController;
  getOriginHref: OriginHrefBuilder;
  announceTimer(message: string): void;
}) {
  const title = activity.title.trim() || "Actividad sin titulo";
  const activityCompletion = activity.activityBlockId
    ? {
        target: {
          routineId: activity.routineId,
          scopeActivityBlockId: activity.activityBlockId,
          blockId: activity.activityBlockId,
          blockType: "activity" as const,
        },
        completed: activity.completed,
      }
    : null;
  const headingId = `activity-${activity.routineId}-${activity.activityBlockId ?? activity.documentOrder}`;

  return (
    <li className="border-b border-neutral-200 py-6 last:border-0 dark:border-neutral-800">
      <article aria-labelledby={headingId}>
        <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap">
          {activity.canComplete && activityCompletion ? (
            <CompletionControl
              completion={activityCompletion}
              date={date}
              dateObserver={dateObserver}
              label={title}
            />
          ) : (
            <span className="text-xs text-neutral-500">
              Estado no disponible
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2
                id={headingId}
                className="text-lg font-semibold tracking-tight"
              >
                {title}
              </h2>
              {activity.scheduledTime ? (
                <time
                  dateTime={activity.scheduledTime}
                  className="font-mono text-sm font-medium text-amber-700 tabular-nums dark:text-amber-400"
                >
                  {activity.scheduledTime}
                </time>
              ) : (
                <span className="text-xs text-neutral-500">Sin hora</span>
              )}
            </div>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              <span aria-hidden="true">{activity.routineIcon}</span>{" "}
              {activity.routineName}
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 pl-7 sm:w-auto sm:justify-end sm:pl-0">
            <TimerAction
              activity={activity}
              timer={timer}
              announce={announceTimer}
            />
            {activity.origin ? (
              <Link
                href={getOriginHref(activity.origin)}
                className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                Abrir origen
              </Link>
            ) : (
              <span className="text-xs text-neutral-500">
                Origen no disponible
              </span>
            )}
          </div>
        </div>

        {activity.subtasks.length > 0 ? (
          <ul
            aria-label={`Subtareas de ${title}`}
            className="mt-4 space-y-2 pl-7"
          >
            {activity.subtasks.map((subtask, index) => {
              const subtaskTitle =
                subtask.title.trim() || "Subtarea sin titulo";
              const subtaskCompletion =
                activity.activityBlockId && subtask.blockId
                  ? {
                      target: {
                        routineId: activity.routineId,
                        scopeActivityBlockId: activity.activityBlockId,
                        blockId: subtask.blockId,
                        blockType: "checklist" as const,
                      },
                      completed: subtask.completed,
                    }
                  : null;
              return (
                <li
                  key={subtask.blockId ?? `missing-${index}`}
                  className="flex min-w-0 items-center gap-3 text-sm"
                  style={{
                    marginInlineStart: `${Math.max(0, subtask.relativeDepth - 1)}rem`,
                  }}
                >
                  {subtask.canComplete && subtaskCompletion ? (
                    <CompletionControl
                      completion={subtaskCompletion}
                      date={date}
                      dateObserver={dateObserver}
                      label={subtaskTitle}
                    />
                  ) : (
                    <span className="text-xs text-neutral-500">
                      Estado no disponible
                    </span>
                  )}
                  <span className="min-w-0 break-words">{subtaskTitle}</span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </article>
    </li>
  );
}

function TodayContent({
  source,
  dateObserver,
  getOriginHref,
}: Omit<TodayViewProps, "completionCache">) {
  const completionCache = useCompletionCache();
  const completionAnnouncement = useCompletionAnnouncement();
  const date = useObservedLocalDate(dateObserver);
  const { query, retry } = useTodayData(source, completionCache, date);
  const timer = useTimer();
  const [timerAnnouncement, setTimerAnnouncement] = useState("");

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-8 sm:py-14">
      <header className="border-b border-neutral-300 pb-6 dark:border-neutral-700">
        <p className="text-xs font-semibold tracking-[0.22em] text-amber-700 uppercase dark:text-amber-400">
          Ritmo diario
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
          Hoy
        </h1>
        {date ? (
          <time
            dateTime={date}
            className="mt-2 block text-neutral-600 capitalize dark:text-neutral-400"
          >
            {formatLocalDate(date)}
          </time>
        ) : (
          <span className="mt-2 block text-neutral-500">
            Calculando fecha local...
          </span>
        )}
      </header>

      <p className="sr-only" aria-live="assertive" aria-atomic="true">
        {completionAnnouncement}
      </p>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {timerAnnouncement}
      </p>

      {query.status === "loading" ? (
        <section
          aria-label="Cargando actividades"
          aria-busy="true"
          className="space-y-5 py-8"
        >
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-16 animate-pulse rounded bg-neutral-200 motion-reduce:animate-none dark:bg-neutral-800"
            />
          ))}
        </section>
      ) : null}

      {query.status === "error" ? (
        <section role="alert" className="py-12">
          <h2 className="text-xl font-semibold">No pudimos cargar Hoy</h2>
          <p className="mt-2 text-neutral-600 dark:text-neutral-400">
            Revisa tu conexion e intenta nuevamente.
          </p>
          <button
            type="button"
            onClick={retry}
            className="mt-5 rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 dark:bg-neutral-100 dark:text-neutral-950"
          >
            Reintentar
          </button>
        </section>
      ) : null}

      {query.status === "loaded" ? (
        <>
          {query.model.diagnostics.length > 0 ? (
            <div
              role="status"
              className="mt-6 border-l-2 border-amber-500 py-1 pl-4 text-sm"
            >
              Algunas actividades tienen datos invalidos. Puedes abrir su origen
              para corregirlas.
            </div>
          ) : null}

          {query.model.activities.length === 0 ? (
            <section className="py-16 text-center">
              <h2 className="text-xl font-semibold">
                No hay actividades para hoy
              </h2>
              <p className="mt-2 text-neutral-600 dark:text-neutral-400">
                Tus notas y rutinas siguen disponibles en sus documentos.
              </p>
            </section>
          ) : (
            <ol aria-label="Actividades de hoy">
              {sortTodayActivities(query.model.activities).map((activity) => (
                <ActivityRow
                  key={`${activity.routineId}:${activity.activityBlockId ?? `missing-${activity.documentOrder}`}`}
                  activity={activity}
                  date={query.date}
                  dateObserver={dateObserver}
                  timer={timer}
                  getOriginHref={getOriginHref}
                  announceTimer={setTimerAnnouncement}
                />
              ))}
            </ol>
          )}
        </>
      ) : null}
    </main>
  );
}

export function TodayView({ completionCache, ...props }: TodayViewProps) {
  return (
    <CompletionProvider cache={completionCache}>
      <TodayContent {...props} />
    </CompletionProvider>
  );
}
