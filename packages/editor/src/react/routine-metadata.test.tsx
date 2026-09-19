import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Routine } from "@ritmo/core";

import { RoutineMetadataEditor } from "./routine-metadata";

const routine: Routine = {
  id: "6dc5a254-20d1-4a58-bb25-f872847aad1b",
  name: "Noche",
  icon: null,
  position: 0,
  recurrenceType: "daily",
  specificDate: null,
  content: { schemaVersion: 1, blocks: [] },
  revision: 0,
};

afterEach(() => cleanup());

describe("RoutineMetadataEditor", () => {
  it("restores the persisted title when rename fails", async () => {
    const onRename = vi.fn().mockRejectedValue(new Error("Sin conexion"));
    render(
      <RoutineMetadataEditor
        onChangeIcon={vi.fn()}
        onChangeRecurrence={vi.fn()}
        onRename={onRename}
        routine={routine}
        saveStatus="Guardado"
      />,
    );
    const input = screen.getByRole("textbox", { name: "Nombre de la rutina" });

    fireEvent.change(input, { target: { value: "Manana" } });
    fireEvent.blur(input);

    await waitFor(() => expect(input).toHaveValue("Noche"));
    expect(screen.getByRole("status")).toHaveTextContent("Sin conexion");
  });
});
