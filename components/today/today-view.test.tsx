import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CompletionKey } from "@/lib/contracts";
import { CompletionStore } from "@/lib/completions";
import {
  LocalDateObserver,
  type TodayActivity,
  type TodayDataSource,
  type TodayReadModel,
} from "@/lib/today";
import { TimerProvider } from "@/components/timer";
import { createTimerStore, silentTimerAudio } from "@/lib/timer";

import { TodayView } from "./today-view";

const routineId = "6dc5a254-20d1-4a58-bb25-f872847aad1b";

afterEach(cleanup);

function createActivity(): TodayActivity {
  return {
    routineId,
    routineName: "Noche",
    routineIcon: null,
    routinePosition: 0,
    activityBlockId: "activity-a",
    title: "Lectura",
    scheduledTime: "22:30",
    documentOrder: 0,
    timer: {
      status: "ready",
      config: { timerType: "countdown", countdownSeconds: 1_800 },
    },
    completed: false,
    canComplete: true,
    timerActive: false,
    subtasks: [
      {
        blockId: "checklist-a",
        title: "Preparar libro",
        relativeDepth: 2,
        completed: false,
        canComplete: true,
      },
    ],
    origin: { routineId, activityBlockId: "activity-a" },
    diagnostics: [],
  };
}

function renderToday({
  model = { activities: [createActivity()], diagnostics: [] },
  loadError = false,
  mark = vi.fn().mockResolvedValue(undefined),
}: {
  model?: TodayReadModel;
  loadError?: boolean;
  mark?: (key: CompletionKey) => Promise<void>;
} = {}) {
  const source: TodayDataSource = {
    load: loadError
      ? vi.fn().mockRejectedValue(new Error("network"))
      : vi.fn().mockResolvedValue(model),
  };
  const repository = {
    mark,
    unmark: vi.fn().mockResolvedValue(undefined),
  };
  const completionCache = new CompletionStore(repository);
  const dateObserver = new LocalDateObserver({
    getDate: () => "2026-09-13",
    getDelay: () => 60_000,
    schedule: () => 1 as unknown as ReturnType<typeof setTimeout>,
    cancel: vi.fn(),
  });
  const timer = createTimerStore({ audio: silentTimerAudio });

  render(
    <TimerProvider store={timer}>
      <TodayView
        source={source}
        completionCache={completionCache}
        dateObserver={dateObserver}
        getOriginHref={({ routineId: id, activityBlockId }) =>
          `/rutinas/${id}?activity=${activityBlockId}`
        }
      />
    </TimerProvider>,
  );

  return { repository, timer };
}

describe("TodayView", () => {
  it("renders a read-only activity and its nested daily subtask", async () => {
    renderToday();

    expect(
      await screen.findByRole("heading", { name: "Lectura" }),
    ).toBeVisible();
    expect(screen.getByText("Preparar libro")).toBeVisible();
    expect(screen.getByRole("link", { name: "Abrir origen" })).toHaveAttribute(
      "href",
      `/rutinas/${routineId}?activity=activity-a`,
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("updates completion optimistically and rolls back accessibly on failure", async () => {
    const user = userEvent.setup();
    const mark = vi.fn().mockRejectedValue(new Error("RLS details"));
    renderToday({ mark });
    const checkbox = await screen.findByRole("checkbox", {
      name: "Marcar Lectura como completada",
    });

    await user.click(checkbox);

    await waitFor(() => expect(checkbox).not.toBeChecked());
    expect(
      screen.getByText(
        "No pudimos guardar el cambio. Restauramos el estado anterior.",
      ),
    ).toBeInTheDocument();
    expect(mark).toHaveBeenCalledWith(
      expect.objectContaining({ completionDate: "2026-09-13" }),
    );
  });

  it("opens the existing singleton instead of replacing it", async () => {
    const user = userEvent.setup();
    const { timer } = renderToday();
    const openFocus = vi.spyOn(timer, "openFocus");
    const start = await screen.findByRole("button", { name: "Iniciar timer" });

    await user.click(start);
    act(() => {
      timer.closeFocus();
    });
    const open = screen.getByRole("button", { name: "Abrir timer" });
    await user.click(open);

    expect(openFocus).toHaveBeenCalledOnce();
  });

  it("renders the real empty state", async () => {
    renderToday({
      model: { activities: [], diagnostics: [] },
    });
    expect(
      await screen.findByText("No hay actividades para hoy"),
    ).toBeVisible();
  });

  it("keeps valid activities visible when projection has diagnostics", async () => {
    renderToday({
      model: {
        activities: [createActivity()],
        diagnostics: [
          {
            routineId,
            diagnostic: {
              code: "ACTIVITY_TIMER_INVALID",
              path: [0],
              message: "invalid block",
            },
          },
        ],
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Lectura" }),
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Algunas actividades tienen datos invalidos",
    );
  });

  it("keeps an ID-less activity visible without completion, timer or origin actions", async () => {
    renderToday({
      model: {
        activities: [
          {
            ...createActivity(),
            activityBlockId: undefined,
            canComplete: false,
            origin: undefined,
          },
        ],
        diagnostics: [],
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Lectura" }),
    ).toBeVisible();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByText("Origen no disponible")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Timer no disponible" }),
    ).toBeDisabled();
  });

  it("shows a safe total query error", async () => {
    renderToday({ loadError: true });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos cargar Hoy",
    );
    expect(screen.queryByText("network")).not.toBeInTheDocument();
  });
});
