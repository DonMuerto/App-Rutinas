"use client";

import { useEffect, useState } from "react";

import { CompletionStore } from "@/lib/completions";
import { createBrowserRepositories } from "@/lib/repositories/browser";
import { LocalDateObserver, RepositoryTodayDataSource } from "@/lib/today";

import { TodayView } from "./today-view";

const dateObserver = new LocalDateObserver();

interface TodayRuntime {
  source: RepositoryTodayDataSource;
  completionCache: CompletionStore;
}

type RuntimeState =
  | { request: number; status: "ready"; runtime: TodayRuntime }
  | { request: number; status: "error" };

export function TodayScreen() {
  const [request, setRequest] = useState(0);
  const [state, setState] = useState<RuntimeState | null>(null);

  useEffect(() => {
    let active = true;

    createBrowserRepositories().then(
      (repositories) => {
        if (!active) return;
        setState({
          request,
          status: "ready",
          runtime: {
            source: new RepositoryTodayDataSource(repositories),
            completionCache: new CompletionStore(repositories.completions),
          },
        });
      },
      () => {
        if (active) {
          setState({ request, status: "error" });
        }
      },
    );

    return () => {
      active = false;
    };
  }, [request]);

  if (!state || state.request !== request) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-8 sm:py-14">
        <p aria-busy="true">Cargando Hoy...</p>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-8 sm:py-14">
        <section role="alert">
          <h1 className="text-3xl font-semibold">No pudimos abrir Hoy</h1>
          <p className="mt-2 text-neutral-600 dark:text-neutral-400">
            Revisa tu sesion o conexion e intenta nuevamente.
          </p>
          <button
            type="button"
            onClick={() => setRequest((current) => current + 1)}
            className="mt-5 rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 dark:bg-neutral-100 dark:text-neutral-950"
          >
            Reintentar
          </button>
        </section>
      </main>
    );
  }

  return (
    <TodayView
      source={state.runtime.source}
      completionCache={state.runtime.completionCache}
      dateObserver={dateObserver}
      getOriginHref={({ routineId, activityBlockId }) =>
        `/rutinas/${routineId}?activity=${encodeURIComponent(activityBlockId)}`
      }
    />
  );
}
