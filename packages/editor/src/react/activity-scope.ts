import type { RitmoEditor } from "./activity-schema";

export function findNearestActivityId(
  editor: RitmoEditor,
  blockId: string,
): string | undefined {
  const visited = new Set<string>();
  let parent = editor.getParentBlock(blockId);
  while (parent && !visited.has(parent.id)) {
    if (parent.type === "activity") return parent.id;
    visited.add(parent.id);
    parent = editor.getParentBlock(parent.id);
  }
  return undefined;
}

export function isInsideActivity(editor: RitmoEditor, blockId: string) {
  return (
    editor.getBlock(blockId)?.type === "activity" ||
    findNearestActivityId(editor, blockId) !== undefined
  );
}
