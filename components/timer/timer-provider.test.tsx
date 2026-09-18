import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTimerStore, type TimerStore } from "@/lib/timer";

import { TimerProvider, useTimer } from "./timer-provider";

afterEach(cleanup);

function StartControl() {
  const timer = useTimer();

  return (
    <button
      onClick={() =>
        timer.start({
          config: { timerType: "countdown", countdownSeconds: 60 },
          origin: {
            activityId: "activity-1",
            activityTitle: "Lectura",
            routineId: "routine-1",
            routineName: "Noche",
          },
        })
      }
      type="button"
    >
      Iniciar lectura
    </button>
  );
}

function renderTimer(store: TimerStore) {
  return render(
    <TimerProvider store={store}>
      <StartControl />
    </TimerProvider>,
  );
}

describe("TimerProvider", () => {
  it("opens an accessible focus overlay and restores focus on close", async () => {
    const user = userEvent.setup();
    const store = createTimerStore({
      clock: { now: () => 0 },
      audio: { prepare: vi.fn(), play: vi.fn() },
    });
    renderTimer(store);

    const startButton = screen.getByRole("button", { name: "Iniciar lectura" });
    await user.click(startButton);

    expect(screen.getByRole("dialog", { name: "Lectura" })).toHaveAttribute(
      "aria-modal",
      "true",
    );
    expect(screen.getByText("Trabajo")).toBeVisible();
    expect(screen.getByLabelText("60 segundos restantes")).toHaveTextContent(
      "01:00",
    );
    expect(
      screen.getByRole("button", { name: "Cerrar modo enfoque" }),
    ).toHaveFocus();

    await user.tab({ shift: true });
    expect(
      screen.getByRole("button", { name: "Cancelar temporizador" }),
    ).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Cerrar modo enfoque" }),
    ).toHaveFocus();

    await user.click(
      screen.getByRole("button", { name: "Cerrar modo enfoque" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(startButton).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Abrir enfoque" }));
    expect(screen.getByRole("dialog", { name: "Lectura" })).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Cerrar modo enfoque" }),
    );
    expect(screen.getByRole("button", { name: "Abrir enfoque" })).toHaveFocus();
  });

  it("keeps the same session when route content changes", async () => {
    const user = userEvent.setup();
    const store = createTimerStore({
      clock: { now: () => 0 },
      audio: { prepare: vi.fn(), play: vi.fn() },
    });
    const view = renderTimer(store);

    await user.click(screen.getByRole("button", { name: "Iniciar lectura" }));
    const session = store.getSnapshot().timer;
    view.rerender(
      <TimerProvider store={store}>
        <p>Otra ruta cliente</p>
      </TimerProvider>,
    );

    expect(store.getSnapshot().timer).toBe(session);
    expect(screen.getByRole("dialog", { name: "Lectura" })).toBeVisible();
  });

  it("shows done as text and frees the singleton only on Dismiss", async () => {
    let now = 0;
    const user = userEvent.setup();
    const store = createTimerStore({
      clock: { now: () => now },
      audio: { prepare: vi.fn(), play: vi.fn() },
    });
    renderTimer(store);
    await user.click(screen.getByRole("button", { name: "Iniciar lectura" }));

    now = 60_000;
    act(() => store.tick());

    expect(screen.getByText("Finalizado")).toBeVisible();
    expect(screen.getByLabelText("0 segundos restantes")).toHaveTextContent(
      "00:00",
    );
    await user.click(screen.getByRole("button", { name: "Descartar" }));

    expect(store.getSnapshot().timer.status).toBe("idle");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("recovers immediately on visibility and keeps a visual signal if audio fails", async () => {
    let now = 0;
    const user = userEvent.setup();
    const store = createTimerStore({
      clock: { now: () => now },
      audio: {
        prepare() {
          throw new Error("blocked");
        },
        play() {
          throw new Error("blocked");
        },
      },
    });
    renderTimer(store);
    await user.click(screen.getByRole("button", { name: "Iniciar lectura" }));

    now = 60_000;
    act(() => document.dispatchEvent(new Event("visibilitychange")));

    const dialog = screen.getByRole("dialog", { name: "Lectura" });
    expect(dialog).toHaveAttribute("data-transition-signal", "done");
    expect(screen.getByText("Temporizador finalizado")).toBeInTheDocument();
    expect(store.getSnapshot().timer.status).toBe("done");
  });

  it("describes the interval position during a set rest", () => {
    let now = 0;
    const store = createTimerStore({
      clock: { now: () => now },
      audio: { prepare: vi.fn(), play: vi.fn() },
    });
    store.start({
      config: {
        timerType: "interval",
        prepareSeconds: 10,
        workSeconds: 20,
        restSeconds: 10,
        cycles: 2,
        sets: 2,
        restBetweenSetsSeconds: 60,
      },
      origin: {
        activityId: "activity-1",
        activityTitle: "Circuito",
        routineId: "routine-1",
        routineName: "Mañana",
      },
    });
    render(
      <TimerProvider store={store}>
        <p>Rutina</p>
      </TimerProvider>,
    );

    now = 60_000;
    act(() => store.tick());

    expect(screen.getByText("Descanso entre sets")).toBeVisible();
    expect(screen.getByText("Entre sets 1 y 2")).toBeVisible();
  });

  it("distinguishes consecutive work phases in live announcements", () => {
    let now = 0;
    const store = createTimerStore({
      clock: { now: () => now },
      audio: { prepare: vi.fn(), play: vi.fn() },
    });
    store.start({
      config: {
        timerType: "interval",
        prepareSeconds: 0,
        workSeconds: 20,
        restSeconds: 0,
        cycles: 2,
        sets: 1,
        restBetweenSetsSeconds: 0,
      },
      origin: {
        activityId: "activity-1",
        activityTitle: "Series",
        routineId: "routine-1",
        routineName: "Mañana",
      },
    });
    render(
      <TimerProvider store={store}>
        <p>Rutina</p>
      </TimerProvider>,
    );

    now = 20_000;
    act(() => store.tick());

    expect(
      screen.getByText("Fase: Trabajo. ciclo 2, set 1"),
    ).toBeInTheDocument();
  });
});
