import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakePlatformServices } from "@ritmo/platform/fakes";
import { ThemeProvider } from "@ritmo/ui";

import { fixtureRoutines } from "../fixtures";
import { AppShell } from "./app-shell";

afterEach(cleanup);

function renderShell(reorderRoutines = vi.fn().mockResolvedValue(undefined)) {
  const platform = createFakePlatformServices();
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/hoy"]}>
        <AppShell
          data={{
            createRoutine: vi.fn(),
            reorderRoutines,
          }}
          lifecycle={platform.lifecycle}
          navigation={platform.navigation}
          routines={fixtureRoutines}
          user={{ id: "user-a", email: "ana@example.com" }}
        >
          <main id="main-content">Contenido</main>
        </AppShell>
      </MemoryRouter>
    </ThemeProvider>,
  );
  return { platform, reorderRoutines };
}

describe("AppShell", () => {
  it("opens an accessible drawer and lets Android back close it first", async () => {
    const user = userEvent.setup();
    const { platform } = renderShell();
    const trigger = screen.getByRole("button", { name: "Abrir menu" });

    await user.click(trigger);
    const drawer = screen.getByRole("dialog", {
      name: "Barra lateral de Ritmo",
    });
    expect(drawer).toHaveAttribute("aria-modal", "true");
    expect(
      within(drawer).getByRole("button", { name: "Cerrar menu" }),
    ).toHaveFocus();

    await platform.emitLifecycle("back-requested");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("supports keyboard reorder controls with optimistic feedback", async () => {
    const user = userEvent.setup();
    const { reorderRoutines } = renderShell();

    await user.click(
      screen.getByRole("button", { name: "Mover Movimiento abajo" }),
    );

    expect(reorderRoutines).toHaveBeenCalledWith([
      "247b24d2-999a-4edc-992b-39ceab7313d0",
      "3947f2ca-d682-42f5-b62f-493a588321ef",
    ]);
    expect(await screen.findByText("Orden guardado.")).toBeInTheDocument();
  });
});
