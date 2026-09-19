import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { createFakePlatformServices } from "@ritmo/platform/fakes";

import { createTimerController, type TimerController } from "./controller";
import { TimerProvider } from "./provider";
import { useTimer } from "./use-timer";

const origin = {
  activityId: "activity-a",
  activityTitle: "Circuito",
  routineId: "routine-a",
  routineName: "Mañana",
} as const;

function createHarness() {
  let now = 0;
  const platform = createFakePlatformServices();
  const controller = createTimerController({
    userId: "user-a",
    contextId: "tab-a",
    lifecycle: platform.lifecycle,
    timerStorage: platform.timerStorage,
    audio: platform.audio,
    clock: { now: () => now },
  });

  return {
    controller,
    setNow(value: number) {
      now = value;
    },
  };
}

function StartControl({
  config = { timerType: "countdown", countdownSeconds: 60 },
}: {
  readonly config?: unknown;
}) {
  const timer = useTimer();

  return (
    <button
      onClick={() => {
        void timer.start({ config, origin });
      }}
      type="button"
    >
      Iniciar circuito
    </button>
  );
}

function renderTimer(controller: TimerController, config?: unknown) {
  return render(
    <TimerProvider controller={controller}>
      <StartControl config={config} />
    </TimerProvider>,
  );
}

afterEach(cleanup);

describe("TimerSurface", () => {
  it("shows a running interval with textual time, progress and position", async () => {
    const user = userEvent.setup();
    const harness = createHarness();
    await harness.controller.ready;
    renderTimer(harness.controller, {
      timerType: "interval",
      prepareSeconds: 10,
      workSeconds: 20,
      restSeconds: 10,
      cycles: 2,
      sets: 2,
      restBetweenSetsSeconds: 30,
    });

    await user.click(screen.getByRole("button", { name: "Iniciar circuito" }));

    const dialog = await screen.findByRole("dialog", { name: "Circuito" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Mañana")).toBeVisible();
    expect(screen.getByText("Preparación")).toBeVisible();
    expect(screen.getByLabelText("10 segundos restantes")).toHaveTextContent(
      "00:10",
    );
    expect(screen.getByText("Preparación / Set 1 de 2")).toBeVisible();
    expect(
      screen.getByRole("progressbar", { name: "Progreso de la fase" }),
    ).toHaveAttribute("aria-valuenow", "0");

    harness.setNow(10_000);
    await act(async () => {
      await harness.controller.tick();
    });

    expect(screen.getByText("Trabajo")).toBeVisible();
    expect(screen.getByText("Ciclo 1 de 2 / Set 1 de 2")).toBeVisible();
    expect(
      screen.getByText("Fase: Trabajo. ciclo 1, set 1"),
    ).toBeInTheDocument();
    harness.controller.dispose();
  });

  it("closes to a dock, reopens, traps focus and closes on Escape", async () => {
    const user = userEvent.setup();
    const harness = createHarness();
    await harness.controller.ready;
    renderTimer(harness.controller);
    const start = screen.getByRole("button", { name: "Iniciar circuito" });

    await user.click(start);
    const close = await screen.findByRole("button", {
      name: "Cerrar modo enfoque",
    });
    expect(close).toHaveFocus();

    await user.tab({ shift: true });
    expect(
      screen.getByRole("button", { name: "Cancelar temporizador" }),
    ).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();

    await user.click(close);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(start).toHaveFocus();
    const dock = screen.getByRole("complementary", {
      name: "Temporizador activo",
    });
    expect(dock).toHaveTextContent("Mañana");
    expect(dock).toHaveTextContent("Circuito");
    expect(dock).toHaveTextContent("Trabajo");
    expect(dock).toHaveTextContent("01:00");

    const open = screen.getByRole("button", { name: "Abrir enfoque" });
    await user.click(open);
    expect(
      await screen.findByRole("dialog", { name: "Circuito" }),
    ).toBeVisible();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir enfoque" })).toHaveFocus();
    expect(harness.controller.getSnapshot().timer.status).toBe("running");
    harness.controller.dispose();
  });

  it("shows done without completing the activity and dismisses the session", async () => {
    const user = userEvent.setup();
    const harness = createHarness();
    await harness.controller.ready;
    renderTimer(harness.controller);

    await user.click(screen.getByRole("button", { name: "Iniciar circuito" }));
    harness.setNow(60_000);
    await act(async () => {
      await harness.controller.tick();
    });

    expect(screen.getByText("Finalizado")).toBeVisible();
    expect(screen.getByLabelText("0 segundos restantes")).toHaveTextContent(
      "00:00",
    );
    expect(screen.getByText("Temporizador finalizado")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancelar temporizador" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Descartar" }));
    await waitFor(() =>
      expect(harness.controller.getSnapshot().timer.status).toBe("idle"),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("complementary", { name: "Temporizador activo" }),
    ).not.toBeInTheDocument();
    harness.controller.dispose();
  });
});
