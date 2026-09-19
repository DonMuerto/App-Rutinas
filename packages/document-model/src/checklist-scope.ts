import type { DocumentBlock } from "./types";

export function getChecklistActivityScopes(
  blocks: readonly DocumentBlock[],
): ReadonlyMap<string, string | undefined> {
  const scopes = new Map<string, string | undefined>();
  const visit = (
    current: readonly DocumentBlock[],
    activityId: string | undefined,
  ) => {
    for (const block of current) {
      const childActivityId = block.type === "activity" ? block.id : activityId;
      if (block.type === "checkListItem" && block.id) {
        scopes.set(block.id, activityId);
      }
      visit(block.children, childActivityId);
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
