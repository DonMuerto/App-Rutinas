import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DomainError, type RoutineMetadata } from "@ritmo/core";
import {
  repositoryInvalidations,
  routineKeys,
  type AuthUser,
  type DataAuthServices,
} from "@ritmo/data-auth";
import { projectActivities } from "@ritmo/document-model";
import {
  CompletionProvider,
  CompletionStore,
  createQueryCachePort,
  createSidebarDataPort,
  createTimerControllerPort,
  createTodayDataSource,
  LocalDateObserver,
  SessionExitCoordinator,
  TodayView,
  useSessionExitPrompt,
  AppShell,
  type SessionExitDecisionPrompt,
} from "@ritmo/features";
import {
  createDraftExitAdapter,
  DraftController,
  type DocumentPersistencePort,
} from "@ritmo/editor";
import type { LifecycleEventType, PlatformServices } from "@ritmo/platform";
import {
  createTimerController,
  TimerProvider,
  type TimerController,
} from "@ritmo/timer";

import { ErrorBoundary } from "./error-boundary";

const LazyRoutineRoute = lazy(() => import("./routine-route"));
const TIMER_CONTEXT_KEY = "ritmo.timer-context.v1";

export interface PrivateResources {
  readonly completions: CompletionStore;
  readonly dateObserver: LocalDateObserver;
  readonly drafts: DraftController;
  readonly sessionExit: SessionExitCoordinator;
  readonly sidebarData: ReturnType<typeof createSidebarDataPort>;
  readonly timer: TimerController;
  readonly timerPort: ReturnType<typeof createTimerControllerPort>;
  readonly todayData: ReturnType<typeof createTodayDataSource>;
}

function executionContextId(platform: PlatformServices) {
  if (platform.info.kind !== "web") return `${platform.info.kind}-main`;
  try {
    const existing = sessionStorage.getItem(TIMER_CONTEXT_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    sessionStorage.setItem(TIMER_CONTEXT_KEY, created);
    return created;
  } catch {
    return "web-main";
  }
}

function documentPersistence(
  services: DataAuthServices,
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string,
): DocumentPersistencePort {
  const routines = services.repositories.routines;
  return {
    async loadDocument(routineId) {
      const routine = await routines.getById(routineId);
      return {
        routineId: routine.id,
        document: routine.content,
        revision: routine.revision,
      };
    },
    async saveDocument({ routineId, document, expectedRevision }) {
      try {
        const revision = await routines.saveDocument(
          routineId,
          expectedRevision,
          document,
        );
        await repositoryInvalidations.routineDocumentSaved(
          queryClient,
          userId,
          routineId,
        );
        return {
          kind: "saved",
          revision,
        };
      } catch (error) {
        if (
          error instanceof DomainError &&
          error.code === "DOCUMENT_CONFLICT"
        ) {
          const remote = await routines.getById(routineId);
          return { kind: "conflict", actualRevision: remote.revision };
        }
        throw error;
      }
    },
    async createFromDraft(input) {
      const routine = await routines.createFromDraft(input);
      await repositoryInvalidations.routineCreated(queryClient, userId);
      return {
        routineId: routine.id,
        document: routine.content,
        revision: routine.revision,
      };
    },
  };
}

function createPrivateResources(options: {
  readonly platform: PlatformServices;
  readonly queryClient: ReturnType<typeof useQueryClient>;
  readonly requestDecision: SessionExitDecisionPrompt;
  readonly services: DataAuthServices;
  readonly userId: string;
}) {
  const { platform, queryClient, requestDecision, services, userId } = options;
  const routines = services.repositories.routines;
  const completionRepository = services.repositories.completions;
  const drafts = new DraftController({
    userId,
    storage: platform.drafts,
    remote: documentPersistence(services, queryClient, userId),
  });
  const timer = createTimerController({
    userId,
    contextId: executionContextId(platform),
    lifecycle: platform.lifecycle,
    timerStorage: platform.timerStorage,
    audio: platform.audio,
  });
  const timerPort = createTimerControllerPort(timer);
  const completions = new CompletionStore({
    async mark(key, signal) {
      await completionRepository.mark(key, signal);
      await repositoryInvalidations.completionChanged(
        queryClient,
        userId,
        key.completionDate,
      );
    },
    async unmark(key, signal) {
      await completionRepository.unmark(key, signal);
      await repositoryInvalidations.completionChanged(
        queryClient,
        userId,
        key.completionDate,
      );
    },
  });
  const sidebarData = createSidebarDataPort({
    async create(input) {
      const routine = await routines.create(input);
      await repositoryInvalidations.routineCreated(queryClient, userId);
      return routine;
    },
    async reorder(orderedIds) {
      await routines.reorder(orderedIds);
      await repositoryInvalidations.routinesReordered(queryClient, userId);
    },
  });
  const todayData = createTodayDataSource({
    routines,
    completions: completionRepository,
    project: projectActivities,
    getActiveTimer() {
      const snapshot = timer.getSnapshot().timer;
      return snapshot.status === "idle"
        ? undefined
        : {
            routineId: snapshot.origin.routineId,
            activityBlockId: snapshot.origin.activityId,
          };
    },
  });
  const dateObserver = new LocalDateObserver({ lifecycle: platform.lifecycle });
  const draftExit = createDraftExitAdapter({
    userId,
    controller: drafts,
    async resolveCopyMetadata(journal) {
      const routine = await routines.getById(journal.routineId);
      return {
        name: `${routine.name} (copia recuperada)`,
        icon: routine.icon,
        recurrenceType: routine.recurrenceType,
        specificDate: routine.specificDate,
      };
    },
  });
  const sessionExit = new SessionExitCoordinator({
    auth: services.auth,
    completions,
    drafts: draftExit,
    queryCache: createQueryCachePort(queryClient),
    timer: timerPort,
    requestDecision,
  });

  return {
    completions,
    dateObserver,
    drafts,
    sessionExit,
    sidebarData,
    timer,
    timerPort,
    todayData,
  } satisfies PrivateResources;
}

function LoadingPrivateApp() {
  return (
    <main aria-busy="true" className="app-state" id="main-content">
      Preparando tu espacio...
    </main>
  );
}

function ReadyPrivateApp({
  dialog,
  platform,
  resources,
  services,
  user,
}: {
  readonly dialog: ReactNode;
  readonly platform: PlatformServices;
  readonly resources: PrivateResources;
  readonly services: DataAuthServices;
  readonly user: AuthUser;
}) {
  const location = useLocation();
  const metadata = useQuery({
    queryKey: routineKeys.metadata(user.id),
    queryFn: () => services.repositories.routines.listMetadata(),
  });
  const routines: readonly RoutineMetadata[] = metadata.data ?? [];

  return (
    <TimerProvider controller={resources.timer}>
      <CompletionProvider store={resources.completions}>
        <AppShell
          data={resources.sidebarData}
          lifecycle={platform.lifecycle}
          navigation={platform.navigation}
          onLogout={async () => {
            await resources.sessionExit.logout(user.id);
          }}
          onRetry={() => void metadata.refetch()}
          routines={routines}
          status={
            metadata.isPending
              ? "loading"
              : metadata.isError
                ? "error"
                : "ready"
          }
          user={user}
        >
          <ErrorBoundary
            key={location.pathname}
            message="El draft local permanece protegido. Puedes reintentar o abrir otra vista."
            title="No pudimos mostrar esta vista"
          >
            <Suspense fallback={<LoadingPrivateApp />}>
              <Routes>
                <Route
                  path="/hoy"
                  element={
                    <TodayView
                      dataSource={resources.todayData}
                      dateObserver={resources.dateObserver}
                      navigation={platform.navigation}
                      timer={resources.timerPort}
                      userId={user.id}
                    />
                  }
                />
                <Route
                  path="/rutinas/:routineId"
                  element={
                    <LazyRoutineRoute
                      resources={resources}
                      services={services}
                      user={user}
                    />
                  }
                />
                <Route path="*" element={<Navigate replace to="/hoy" />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </AppShell>
        {dialog}
      </CompletionProvider>
    </TimerProvider>
  );
}

export function PrivateApp({
  platform,
  services,
  user,
}: {
  readonly platform: PlatformServices;
  readonly services: DataAuthServices;
  readonly user: AuthUser;
}) {
  const queryClient = useQueryClient();
  const { cancel, dialog, isOpen, requestDecision } = useSessionExitPrompt();
  const [resources, setResources] = useState<PrivateResources | null>(null);
  const activeResources = useRef<PrivateResources | null>(null);
  const handlePromptLifecycle = useCallback(
    (event: LifecycleEventType) => {
      if (event !== "back-requested" || !isOpen) return "continue" as const;
      cancel();
      return "handled" as const;
    },
    [cancel, isOpen],
  );
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const created = createPrivateResources({
        platform,
        queryClient,
        requestDecision,
        services,
        userId: user.id,
      });
      activeResources.current = created;
      setResources(created);
    });
    return () => {
      active = false;
      const created = activeResources.current;
      activeResources.current = null;
      if (!created) return;
      created.timer.dispose();
      void created.drafts.dispose();
    };
  }, [platform, queryClient, requestDecision, services, user.id]);

  useEffect(() => {
    if (!resources) return;
    const stopPrompt = platform.lifecycle.subscribe(handlePromptLifecycle, {
      priority: 100,
    });
    const stopDrafts = platform.lifecycle.subscribe(
      async (event) => {
        if (
          event !== "background" &&
          event !== "close-requested" &&
          event !== "back-requested"
        ) {
          return "continue";
        }
        await resources.drafts.protectLocal();
        const storageFailed = resources.drafts
          .getSnapshot()
          .drafts.some((draft) => !draft.locallyProtected);
        if (storageFailed) return "handled";
        if (event === "back-requested") {
          void resources.drafts.flushAll().catch(() => undefined);
        }
        return "continue";
      },
      { priority: 25 },
    );
    const stopAuth = services.auth.subscribe((snapshot, previous) => {
      if (
        snapshot.status === "session-expired" &&
        previous.user?.id === user.id
      ) {
        void resources.sessionExit.handleExpiration(user.id);
      }
    });
    return () => {
      stopAuth();
      stopDrafts();
      stopPrompt();
    };
  }, [
    handlePromptLifecycle,
    platform.lifecycle,
    resources,
    services.auth,
    user.id,
  ]);

  return resources ? (
    <ReadyPrivateApp
      dialog={dialog}
      platform={platform}
      resources={resources}
      services={services}
      user={user}
    />
  ) : (
    <LoadingPrivateApp />
  );
}
