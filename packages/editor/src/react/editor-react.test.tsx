import { BlockNoteEditor } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activityDefaults, type CompletionKey } from "@ritmo/core";
import {
  getChecklistActivityScopes,
  serializeDocument,
} from "@ritmo/document-model";

import {
  ActivityRuntimeProvider,
  type ActivityRuntimeValue,
} from "./activity-runtime";
import { ritmoSchema, type RitmoPartialBlock } from "./activity-schema";
import {
  applyDailyChecklistState,
  interceptDailyChecklistClick,
  normalizeChecklistScopeTransitions,
  toDocumentBlocks,
} from "./checklist-completions";
import { focusBlockById } from "./focus-block";

const initialContent = [
  {
    id: "activity-a",
    type: "activity",
    props: { ...activityDefaults, scheduledTime: "" },
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
  if (!input) throw new Error(`No se encontro ${blockId}.`);
  return input;
}

function checked(editor: ReturnType<typeof createEditor>, blockId: string) {
  const block = editor.getBlock(blockId);
  if (block?.type !== "checkListItem") throw new Error("Checklist invalida.");
  return block.props.checked;
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

describe("BlockNote Activity adapter", () => {
  it("round-trips IDs and emits the canonical envelope", () => {
    const editor = createEditor();
    const document = serializeDocument(toDocumentBlocks(editor.document));
    const second = BlockNoteEditor.create({
      schema: ritmoSchema,
      initialContent: document.blocks as unknown as RitmoPartialBlock[],
    });

    expect(second.document).toEqual(editor.document);
    const inserted = second.insertBlocks(
      [
        {
          type: "activity",
          props: { ...activityDefaults, scheduledTime: "" },
          content: "Copia",
          children: [{ type: "checkListItem", content: "Nueva" }],
        },
      ],
      "activity-a",
      "after",
    );
    expect(inserted[0]?.id).not.toBe("activity-a");
    expect(inserted[0]?.children[0]?.id).not.toBe("daily-check");
  });

  it("preserves semantically invalid Activity props for correction", () => {
    const editor = BlockNoteEditor.create({
      schema: ritmoSchema,
      initialContent: [
        {
          id: "invalid-activity",
          type: "activity",
          props: {
            ...activityDefaults,
            schemaVersion: 9,
            scheduledTime: "25:00",
            timerType: "countdown",
            countdownSeconds: 3,
          },
          content: "Corregir",
        },
      ],
    });

    const document = serializeDocument(toDocumentBlocks(editor.document));
    expect(document.blocks[0]).toMatchObject({
      props: {
        schemaVersion: 9,
        scheduledTime: "25:00",
        timerType: "countdown",
        countdownSeconds: 3,
      },
    });
  });

  it("clears native checked when a checklist enters Activity scope", () => {
    const editor = createEditor();
    const before = getChecklistActivityScopes(
      toDocumentBlocks(editor.document),
    );
    editor.setTextCursorPosition("normal-check");
    editor.nestBlock();

    normalizeChecklistScopeTransitions(editor, before);
    expect(checked(editor, "normal-check")).toBe(false);
  });

  it("keeps daily completion outside checked and editor history", () => {
    const editor = createEditor();
    const onChange = vi.fn();
    const setCompleted = vi.fn().mockResolvedValue(undefined);
    let completed = false;
    const runtime: ActivityRuntimeValue = {
      routineId: "6dc5a254-20d1-4a58-bb25-f872847aad1b",
      routineName: "Noche",
      localDate: "2026-09-18",
      canUseBlockId: () => true,
      announce: vi.fn(),
      completions: {
        getState: () => ({ completed, pending: false }),
        setCompleted,
      },
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

    fireEvent.click(checklistInput(container, "daily-check"));
    expect(setCompleted).toHaveBeenCalledWith(
      expect.objectContaining<Partial<CompletionKey>>({
        scopeActivityBlockId: "activity-a",
        blockId: "daily-check",
      }),
      true,
    );
    expect(checked(editor, "daily-check")).toBe(false);
    expect(onChange).not.toHaveBeenCalled();

    completed = true;
    applyDailyChecklistState(container, editor, runtime);
    expect(checklistInput(container, "daily-check")).toBeChecked();
    fireEvent.click(checklistInput(container, "normal-check"));
    expect(checked(editor, "normal-check")).toBe(true);
  });

  it("focuses a nested stable block with public BlockNote APIs", () => {
    const editor = createEditor();
    const { container } = render(<BlockNoteView editor={editor} />);
    expect(focusBlockById(editor, container, "daily-check")).toBe("focused");
    expect(editor.getTextCursorPosition().block.id).toBe("daily-check");
    expect(focusBlockById(editor, container, "missing")).toBe("missing");
  });

  it("starts a validated timer snapshot from the inline Activity", async () => {
    const editor = createEditor();
    const start = vi.fn().mockReturnValue({ ok: true });
    const runtime: ActivityRuntimeValue = {
      routineId: "6dc5a254-20d1-4a58-bb25-f872847aad1b",
      routineName: "Noche",
      localDate: "2026-09-18",
      canUseBlockId: () => true,
      announce: vi.fn(),
      completions: {
        getState: () => ({ completed: false, pending: false }),
        setCompleted: vi.fn(),
      },
      timer: { start, openFocus: vi.fn() },
    };
    render(
      <ActivityRuntimeProvider value={runtime}>
        <BlockNoteView editor={editor} />
      </ActivityRuntimeProvider>,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Configurar Ejercicio" }),
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Temporizador" }), {
      target: { value: "countdown" },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Iniciar temporizador de Ejercicio",
      }),
    );
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: expect.objectContaining({ activityBlockId: "activity-a" }),
        config: { timerType: "countdown", countdownSeconds: 1_800 },
      }),
    );
  });
});
