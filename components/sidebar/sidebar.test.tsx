import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RoutineMetadata } from "@/lib/contracts";

import { Sidebar } from "./sidebar";

const navigation = vi.hoisted(() => ({
  pathname: "/hoy",
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: navigation.push }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const routines: readonly RoutineMetadata[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Mañana",
    icon: "M",
    position: 0,
    recurrenceType: "daily",
    specificDate: null,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Noche",
    icon: "N",
    position: 1,
    recurrenceType: "specific_date",
    specificDate: "2026-09-13",
  },
];

function renderSidebar(
  overrides: Partial<React.ComponentProps<typeof Sidebar>> = {},
) {
  return render(
    <Sidebar
      isCollapsed={false}
      mobileOpen={false}
      onCloseMobile={vi.fn()}
      onToggleCollapsed={vi.fn()}
      routines={routines}
      {...overrides}
    />,
  );
}

function routineLinks() {
  return screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("href")?.startsWith("/rutinas/"));
}

describe("Sidebar", () => {
  it("renders a flat routine list with navigation metadata", () => {
    renderSidebar();

    expect(screen.getByRole("link", { name: "Hoy" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: /Mañana/ })).toHaveAttribute(
      "href",
      "/rutinas/11111111-1111-4111-8111-111111111111",
    );
    expect(screen.getByText("13 sept")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mover Mañana abajo" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Mover Noche abajo" }),
    ).toBeDisabled();
  });

  it("reorders optimistically and restores the previous order on failure", async () => {
    const user = userEvent.setup();
    const reorder = vi.fn().mockRejectedValue(new Error("network"));
    renderSidebar({ onReorderRoutines: reorder });

    await user.click(
      screen.getByRole("button", { name: "Mover Mañana abajo" }),
    );

    expect(reorder).toHaveBeenCalledWith([
      "22222222-2222-4222-8222-222222222222",
      "11111111-1111-4111-8111-111111111111",
    ]);
    await waitFor(() =>
      expect(
        screen.getByText(
          "No se pudo guardar el orden. Restauramos la posición anterior.",
        ),
      ).toBeVisible(),
    );
    expect(routineLinks()[0]).toHaveAccessibleName(/Mañana/);
    expect(routineLinks()[1]).toHaveAccessibleName(/Noche/);
  });

  it("creates a routine and navigates to its document", async () => {
    const user = userEvent.setup();
    const createdRoutine: RoutineMetadata = {
      id: "33333333-3333-4333-8333-333333333333",
      name: "Lectura",
      icon: null,
      position: 2,
      recurrenceType: "daily",
      specificDate: null,
    };
    const createRoutine = vi.fn().mockResolvedValue(createdRoutine);
    renderSidebar({ onCreateRoutine: async (name) => createRoutine(name) });

    await user.click(screen.getByRole("button", { name: "Nueva página" }));
    const input = screen.getByRole("textbox", { name: "Nueva página" });
    await user.clear(input);
    await user.type(input, "Lectura");
    await user.click(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => expect(createRoutine).toHaveBeenCalledWith("Lectura"));
    expect(navigation.push).toHaveBeenCalledWith(
      "/rutinas/33333333-3333-4333-8333-333333333333",
    );
  });

  it("closes the mobile drawer with Escape", async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    renderSidebar({ mobileOpen: true, onCloseMobile: close });

    await user.keyboard("{Escape}");

    expect(close).toHaveBeenCalledOnce();
  });
});
