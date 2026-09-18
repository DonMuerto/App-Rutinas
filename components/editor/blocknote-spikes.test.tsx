import { BlockNoteEditor } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { activityDefaults } from "@/lib/contracts";
import {
  ritmoSchema,
  type RitmoBlock,
  type RitmoPartialBlock,
} from "@/lib/blocknote/activity-block-spec";
import { focusBlockById } from "@/lib/blocknote/focus-block";

import {
  applyDailyChecklistState,
  interceptDailyChecklistClick,
  normalizeChecklistScopeTransitions,
} from "./checklist-completions";
import {
  ActivityRuntimeProvider,
  type ActivityRuntimeValue,
} from "./activity-runtime";
import { NumberField } from "./activity-settings";
import { getChecklistActivityScopes } from "@/lib/blocknote/activity-scope";

const initialContent = [
  {
    id: "activity-a",
    type: "activity",
    props: activityDefaults,
    content: "Ejercicio",
    children: [
      {
        id: "daily-check",
        type: "checkListItem",
        props: { checked: false },
        content: "Calentar",
      },
    ],
  },
  {
    id: "normal-check",
    type: "checkListItem",
    props: { checked: false },
    content: "Comprar agua",
  },
] satisfies RitmoPartialBlock[];

function createEditor() {
  return BlockNoteEditor.create({ schema: ritmoSchema, initialContent });
}

function isChecked(editor: ReturnType<typeof createEditor>, blockId: string) {
  const block = editor.getBlock(blockId);
  if (block?.type !== "checkListItem") {
    throw new Error(`El bloque ${blockId} no es una checklist.`);
  }
  return block.props.checked;
}

function checklistInput(container: HTMLElement, blockId: string) {
  const input = [
    ...container.querySelectorAll<HTMLInputElement>(
      "[data-content-type='checkListItem'] input[type='checkbox']",
    ),
  ].find(
    (candidate) =>
      candidate.closest<HTMLElement>("[data-node-type='blockContainer']")
        ?.dataset.id === blockId,
  );
  if (!input) throw new Error(`No se encontro el checkbox ${blockId}.`);
  return input;
}

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches: true,
      media: "",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    })),
  });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: vi.fn(() => null),
  });
  Object.defineProperty(document, "elementsFromPoint", {
    configurable: true,
    value: vi.fn(() => []),
  });
  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value: vi.fn(() => []),
  });
  Object.defineProperty(Range.prototype, "getBoundingClientRect", {
    configurable: true,
    value: vi.fn(() => new DOMRect()),
  });
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function showModal(this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function close(this: HTMLDialogElement) {
      this.open = false;
    },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("BlockNote completion spike", () => {
  it("proves the native checklist writes checked into the document", async () => {
    const editor = createEditor();
    const onChange = vi.fn();
    const { container } = render(
      <BlockNoteView editor={editor} onChange={onChange} />,
    );

    fireEvent.click(checklistInput(container, "daily-check"));

    expect(isChecked(editor, "daily-check")).toBe(true);
    expect(onChange).toHaveBeenCalled();
    editor.undo();
    expect(isChecked(editor, "daily-check")).toBe(false);
  });

  it("overlays daily state without document changes or autosave", async () => {
    const editor = createEditor();
    const onChange = vi.fn();
    const toggleCompletion = vi.fn();
    let completed = false;
    const runtime: ActivityRuntimeValue = {
      routineId: "22222222-2222-4222-8222-222222222222",
      routineName: "Noche",
      localDate: "2026-09-13",
      isCompleted: () => completed,
      toggleCompletion,
    };
    const { container } = render(
      <ActivityRuntimeProvider value={runtime}>
        <BlockNoteView
          editor={editor}
          onChange={onChange}
          onClickCapture={(event) =>
            interceptDailyChecklistClick(event, editor, runtime)
          }
        />
      </ActivityRuntimeProvider>,
    );
    const input = checklistInput(container, "daily-check");

    fireEvent.click(input);

    expect(toggleCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        scopeActivityBlockId: "activity-a",
        blockId: "daily-check",
        blockType: "checklist",
      }),
      true,
    );
    expect(isChecked(editor, "daily-check")).toBe(false);
    expect(onChange).not.toHaveBeenCalled();

    completed = true;
    applyDailyChecklistState(container, editor, runtime);
    expect(input).toBeChecked();
    expect(isChecked(editor, "daily-check")).toBe(false);

    fireEvent.click(checklistInput(container, "normal-check"));
    expect(isChecked(editor, "normal-check")).toBe(true);
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("clears native checked when a checklist moves into Activity scope", () => {
    const editor = createEditor();
    editor.updateBlock("normal-check", { props: { checked: true } });
    const previousScopes = getChecklistActivityScopes(
      editor.document as RitmoBlock[],
    );

    editor.setTextCursorPosition("normal-check");
    editor.nestBlock();
    const currentScopes = normalizeChecklistScopeTransitions(
      editor,
      previousScopes,
    );

    expect(currentScopes.get("normal-check")).toBe("activity-a");
    expect(isChecked(editor, "normal-check")).toBe(false);
  });
});

describe("BlockNote focus and identity spike", () => {
  it("finds, focuses and scrolls to a stable nested block ID", () => {
    const editor = createEditor();
    const { container } = render(<BlockNoteView editor={editor} />);

    expect(focusBlockById(editor, container, "daily-check")).toBe("focused");
    expect(editor.getTextCursorPosition().block.id).toBe("daily-check");
    expect(editor.isFocused()).toBe(true);
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
      block: "center",
      inline: "nearest",
      behavior: "auto",
    });
    expect(focusBlockById(editor, container, "deleted")).toBe("missing");
  });

  it("round-trips props, structure and IDs and generates IDs for copies", () => {
    const first = createEditor();
    render(<BlockNoteView editor={first} />);
    const persisted = first.document;
    const second = BlockNoteEditor.create({
      schema: ritmoSchema,
      initialContent: persisted,
    });
    render(<BlockNoteView editor={second} />);

    expect(second.document).toEqual(persisted);
    const inserted = second.insertBlocks(
      [
        {
          type: "activity",
          props: activityDefaults,
          content: "Ejercicio",
          children: [
            {
              type: "checkListItem",
              props: { checked: false },
              content: "Calentar",
            },
          ],
        },
      ],
      "activity-a",
      "after",
    );

    expect(inserted[0]?.id).not.toBe("activity-a");
    expect(inserted[0]?.children[0]?.id).not.toBe("daily-check");
  });
});

describe("Activity block", () => {
  it("repairs a malformed numeric prop without propagating NaN", () => {
    const onChange = vi.fn();
    render(
      <NumberField
        label="Duracion"
        max={86_400}
        min={60}
        onChange={onChange}
        step={60}
        unit="segundos"
        value={Number.NaN}
      />,
    );

    expect(
      screen.getByRole("spinbutton", { name: "Duracion en segundos" }),
    ).toHaveValue(null);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Aumentar duracion a 60 segundos",
      }),
    );
    expect(onChange).toHaveBeenCalledWith(60);
  });

  it("edits timer props contextually and starts with a validated snapshot", async () => {
    const editor = createEditor();
    const startTimer = vi.fn();
    const runtime: ActivityRuntimeValue = {
      routineId: "22222222-2222-4222-8222-222222222222",
      routineName: "Noche",
      localDate: "2026-09-13",
      isCompleted: () => false,
      toggleCompletion: vi.fn(),
      startTimer,
    };
    render(
      <ActivityRuntimeProvider value={runtime}>
        <BlockNoteView editor={editor} />
      </ActivityRuntimeProvider>,
    );

    const start = await screen.findByRole("button", {
      name: "Iniciar temporizador de Ejercicio",
    });
    expect(start).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Configurar Ejercicio" }),
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Temporizador" }), {
      target: { value: "countdown" },
    });

    expect(start).toBeEnabled();
    fireEvent.click(start);
    expect(startTimer).toHaveBeenCalledWith(
      expect.objectContaining({
        activityBlockId: "activity-a",
        activityTitle: "Ejercicio",
        config: { timerType: "countdown", countdownSeconds: 1_800 },
      }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Cerrar configuracion" }),
    );
    await vi.waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Configurar Ejercicio" }),
      ).toHaveFocus(),
    );
  });
});
