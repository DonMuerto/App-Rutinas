import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ThemeStorage } from "./theme-context";
import { ThemeProvider } from "./theme-provider";
import { ThemeToggle } from "./theme-toggle";

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.theme;
  document.documentElement.style.colorScheme = "";
});

describe("ThemeProvider", () => {
  it("restores, applies and persists a theme preference", async () => {
    const user = userEvent.setup();
    const storage: ThemeStorage = {
      get: vi.fn().mockResolvedValue("dark"),
      set: vi.fn().mockResolvedValue(undefined),
    };
    render(
      <ThemeProvider storage={storage}>
        <ThemeToggle />
      </ThemeProvider>,
    );

    const toggle = await screen.findByRole("button", {
      name: "Usar tema claro",
    });
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");

    await user.click(toggle);

    await waitFor(() => expect(storage.set).toHaveBeenCalledWith("light"));
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });
});
