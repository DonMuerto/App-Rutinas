import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@ritmo/ui";

import type { AuthServicePort } from "../contracts";
import { AuthForm } from "./auth-form";
import { AuthScreen } from "./auth-screen";

afterEach(cleanup);

function renderLogin(auth: AuthServicePort, onSuccess = vi.fn()) {
  render(
    <ThemeProvider>
      <MemoryRouter>
        <AuthScreen mode="login">
          <AuthForm auth={auth} mode="login" onSuccess={onSuccess} />
        </AuthScreen>
      </MemoryRouter>
    </ThemeProvider>,
  );
  return onSuccess;
}

describe("AuthForm", () => {
  it("validates credentials before calling auth", async () => {
    const user = userEvent.setup();
    const auth: AuthServicePort = {
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    };
    renderLogin(auth);

    await user.type(screen.getByLabelText("Email"), "no-es-email");
    await user.type(screen.getByLabelText("Contrasena"), "123");
    await user.click(screen.getByRole("button", { name: "Iniciar sesion" }));

    expect(screen.getByRole("alert")).toHaveTextContent("email valido");
    expect(auth.login).not.toHaveBeenCalled();
  });

  it("submits through the auth port and reports success", async () => {
    const user = userEvent.setup();
    const auth: AuthServicePort = {
      login: vi.fn().mockResolvedValue({ id: "user-a" }),
      register: vi.fn(),
      logout: vi.fn(),
    };
    const onSuccess = renderLogin(auth);

    await user.type(screen.getByLabelText("Email"), "ana@example.com");
    await user.type(screen.getByLabelText("Contrasena"), "secreto1");
    await user.click(screen.getByRole("button", { name: "Iniciar sesion" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(auth.login).toHaveBeenCalledWith("ana@example.com", "secreto1");
  });

  it("announces authentication failures", async () => {
    const user = userEvent.setup();
    const auth: AuthServicePort = {
      login: vi.fn().mockRejectedValue(new Error("network")),
      register: vi.fn(),
      logout: vi.fn(),
    };
    renderLogin(auth);

    await user.type(screen.getByLabelText("Email"), "ana@example.com");
    await user.type(screen.getByLabelText("Contrasena"), "secreto1");
    await user.click(screen.getByRole("button", { name: "Iniciar sesion" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos iniciar sesion",
    );
  });
});
