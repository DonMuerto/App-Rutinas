import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SessionExitDialog } from "./session-exit-dialog";

afterEach(cleanup);

describe("SessionExitDialog", () => {
  it("exposes labelled choices, traps focus and supports Escape", async () => {
    const user = userEvent.setup();
    const onDecision = vi.fn();
    render(
      <SessionExitDialog
        onDecision={onDecision}
        open
        state={{ pendingCount: 2, canSync: true }}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "Hay cambios sin sincronizar" }),
    ).toHaveAccessibleDescription(/2 rutinas/);
    await waitFor(() =>
      expect(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Cerrar dialogo",
        }),
      ).toHaveFocus(),
    );

    await user.keyboard("{Escape}");
    expect(onDecision).toHaveBeenCalledWith("cancel");
  });
});
