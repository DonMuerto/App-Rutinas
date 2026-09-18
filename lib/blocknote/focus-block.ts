import type { RitmoEditor } from "./activity-block-spec";

export type FocusBlockResult = "focused" | "missing";

export function focusBlockById(
  editor: RitmoEditor,
  root: HTMLElement,
  blockId: string,
): FocusBlockResult {
  const block = editor.getBlock(blockId);
  if (!block) {
    return "missing";
  }

  editor.setTextCursorPosition(block, "start");
  editor.focus();

  const element = [...root.querySelectorAll<HTMLElement>("[data-id]")].find(
    (candidate) => candidate.dataset.id === blockId,
  );
  element?.scrollIntoView({
    block: "center",
    inline: "nearest",
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  });

  return "focused";
}
