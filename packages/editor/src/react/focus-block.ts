import type { RitmoEditor } from "./activity-schema";

export type FocusBlockResult = "focused" | "missing";

export function focusBlockById(
  editor: RitmoEditor,
  root: HTMLElement,
  blockId: string,
): FocusBlockResult {
  const block = editor.getBlock(blockId);
  if (!block) return "missing";
  editor.setTextCursorPosition(block, "start");
  editor.focus();
  const element = [...root.querySelectorAll<HTMLElement>("[data-id]")].find(
    (candidate) => candidate.dataset.id === blockId,
  );
  element?.classList.add("ritmo-source-highlight");
  element?.scrollIntoView({
    block: "center",
    inline: "nearest",
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  });
  if (element) {
    window.setTimeout(
      () => element.classList.remove("ritmo-source-highlight"),
      2_000,
    );
  }
  return "focused";
}
