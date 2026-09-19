import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ErrorBoundary } from "./error-boundary";

describe("ErrorBoundary", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

  afterEach(() => {
    consoleError.mockClear();
  });

  it("isolates a render failure and retries without replacing the application", async () => {
    let shouldFail = true;
    function Content() {
      if (shouldFail) throw new Error("route failed");
      return <p>Contenido restaurado</p>;
    }

    render(
      <ErrorBoundary
        message="El draft local permanece protegido."
        onReset={() => {
          shouldFail = false;
        }}
        title="No pudimos mostrar esta vista"
      >
        <Content />
      </ErrorBoundary>,
    );

    expect(
      screen.getByRole("heading", { name: "No pudimos mostrar esta vista" }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(screen.getByText("Contenido restaurado")).toBeInTheDocument();
  });
});
