import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Routine } from "@/lib/contracts";

import { RoutineMetadataEditor } from "./routine-metadata";

afterEach(cleanup);

const routine: Routine = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Viaje",
  icon: "V",
  position: 0,
  recurrenceType: "specific_date",
  specificDate: "2026-09-13",
  content: [],
};

function renderMetadata() {
  const onRename = vi.fn().mockResolvedValue(undefined);
  const onChangeIcon = vi.fn().mockResolvedValue(undefined);
  const onChangeRecurrence = vi.fn().mockResolvedValue(undefined);
  const onDraftChange = vi.fn();
  render(
    <RoutineMetadataEditor
      onChangeIcon={onChangeIcon}
      onChangeRecurrence={onChangeRecurrence}
      onDraftChange={onDraftChange}
      onRename={onRename}
      routine={routine}
      saveStatus="Sin cambios"
    />,
  );
  return { onRename, onChangeIcon, onChangeRecurrence, onDraftChange };
}

describe("RoutineMetadataEditor", () => {
  it("renames only with a valid trimmed routines.name", async () => {
    const { onRename, onDraftChange } = renderMetadata();
    const name = screen.getByRole("textbox", { name: "Nombre de la rutina" });
    fireEvent.change(name, { target: { value: "  Noche  " } });
    fireEvent.blur(name);

    await waitFor(() => expect(onRename).toHaveBeenCalledWith("Noche"));
    expect(onDraftChange).toHaveBeenCalledWith("routine-name", true);
    expect(onDraftChange).toHaveBeenLastCalledWith("routine-name", false);
  });

  it("switching to daily clears the specific date atomically", async () => {
    const { onChangeRecurrence } = renderMetadata();
    fireEvent.change(screen.getByRole("combobox", { name: "Recurrencia" }), {
      target: { value: "daily" },
    });

    await waitFor(() =>
      expect(onChangeRecurrence).toHaveBeenCalledWith({
        recurrenceType: "daily",
        specificDate: null,
      }),
    );
    expect(screen.queryByLabelText("Fecha especifica")).not.toBeInTheDocument();
  });

  it("saves icon separately from the document", async () => {
    const { onChangeIcon } = renderMetadata();
    const icon = screen.getByRole("textbox", { name: "Icono de la rutina" });
    fireEvent.change(icon, { target: { value: "moon" } });
    fireEvent.blur(icon);

    await waitFor(() => expect(onChangeIcon).toHaveBeenCalledWith("moon"));
  });
});
