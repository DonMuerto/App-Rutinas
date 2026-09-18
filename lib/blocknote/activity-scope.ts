import type { RitmoBlock, RitmoEditor } from "./activity-block-spec";

export function findNearestActivityId(
  editor: RitmoEditor,
  blockId: string,
): string | undefined {
  const visited = new Set<string>();
  let parent = editor.getParentBlock(blockId);

  while (parent && !visited.has(parent.id)) {
    if (parent.type === "activity") {
      return parent.id;
    }

    visited.add(parent.id);
    parent = editor.getParentBlock(parent.id);
  }

  return undefined;
}

export function isInsideActivity(editor: RitmoEditor, blockId: string) {
  const block = editor.getBlock(blockId);
  return (
    block?.type === "activity" ||
    findNearestActivityId(editor, blockId) !== undefined
  );
}

export function getChecklistActivityScopes(
  blocks: readonly RitmoBlock[],
): ReadonlyMap<string, string | undefined> {
  const scopes = new Map<string, string | undefined>();

  const visit = (
    current: readonly RitmoBlock[],
    activityId: string | undefined,
  ) => {
    for (const block of current) {
      const childActivityId = block.type === "activity" ? block.id : activityId;
      if (block.type === "checkListItem") {
        scopes.set(block.id, activityId);
      }
      visit(block.children as RitmoBlock[], childActivityId);
    }
  };
  visit(blocks, undefined);

  return scopes;
}

export function getChecklistScopeTransitions(
  previous: ReadonlyMap<string, string | undefined>,
  current: ReadonlyMap<string, string | undefined>,
) {
  const transitioned = new Set<string>();

  for (const [blockId, activityId] of current) {
    if (
      (previous.has(blockId) && previous.get(blockId) !== activityId) ||
      (!previous.has(blockId) && activityId !== undefined)
    ) {
      transitioned.add(blockId);
    }
  }

  return transitioned;
}
