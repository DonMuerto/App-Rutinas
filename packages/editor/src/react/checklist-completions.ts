import type { MouseEvent as ReactMouseEvent } from "react";
import type { CompletionKey } from "@ritmo/core";
import {
  getChecklistActivityScopes,
  getChecklistScopeTransitions,
  getInlinePlainText,
  type DocumentBlock,
} from "@ritmo/document-model";

import { findNearestActivityId } from "./activity-scope";
import type { RitmoBlock, RitmoEditor } from "./activity-schema";
import type { ActivityRuntimeValue } from "./activity-runtime";

function getChecklistInput(target: EventTarget | null) {
  return target instanceof HTMLInputElement && target.type === "checkbox"
    ? target
    : undefined;
}

function getBlockId(input: HTMLInputElement) {
  return input.closest<HTMLElement>(
    "[data-node-type='blockContainer'][data-id]",
  )?.dataset.id;
}

function completionKey(
  runtime: ActivityRuntimeValue,
  activityId: string,
  blockId: string,
): CompletionKey {
  return {
    routineId: runtime.routineId,
    scopeActivityBlockId: activityId,
    blockId,
    blockType: "checklist",
    completionDate: runtime.localDate,
  };
}

export function normalizeChecklistScopeTransitions(
  editor: RitmoEditor,
  previous: ReadonlyMap<string, string | undefined>,
) {
  const current = getChecklistActivityScopes(
    editor.document as unknown as DocumentBlock[],
  );
  const transitioned = getChecklistScopeTransitions(previous, current);
  editor.transact(() => {
    for (const blockId of transitioned) {
      const block = editor.getBlock(blockId);
      if (block?.type === "checkListItem" && block.props.checked) {
        editor.updateBlock(block, { props: { checked: false } });
      }
    }
  });
  return current;
}

export function applyDailyChecklistState(
  root: HTMLElement,
  editor: RitmoEditor,
  runtime: ActivityRuntimeValue,
) {
  root
    .querySelectorAll<HTMLInputElement>(
      "[data-content-type='checkListItem'] input[type='checkbox']",
    )
    .forEach((input) => {
      const blockId = getBlockId(input);
      if (!blockId) return;
      const activityId = findNearestActivityId(editor, blockId);
      if (!activityId) return;
      const stable =
        runtime.canUseBlockId(activityId) && runtime.canUseBlockId(blockId);
      const key = completionKey(runtime, activityId, blockId);
      const state = stable
        ? runtime.completions.getState(key)
        : { completed: false, pending: false };
      input.checked = state.completed;
      input.disabled = !stable || state.pending;
      const checklistTitle = getInlinePlainText(
        editor.getBlock(blockId)?.content,
      ).trim();
      const activityTitle = getInlinePlainText(
        editor.getBlock(activityId)?.content,
      ).trim();
      input.setAttribute(
        "aria-label",
        `${state.completed ? "Desmarcar" : "Completar"} ${checklistTitle || "subtarea"} de ${activityTitle || "la actividad"}`,
      );
    });
}

export function interceptDailyChecklistClick(
  event: ReactMouseEvent<HTMLDivElement>,
  editor: RitmoEditor,
  runtime: ActivityRuntimeValue,
) {
  const input = getChecklistInput(event.target);
  if (!input) return false;
  const blockId = getBlockId(input);
  if (!blockId || editor.getBlock(blockId)?.type !== "checkListItem") {
    return false;
  }
  const activityId = findNearestActivityId(editor, blockId);
  if (!activityId) return false;

  event.preventDefault();
  event.stopPropagation();
  if (!runtime.canUseBlockId(activityId) || !runtime.canUseBlockId(blockId)) {
    input.checked = false;
    return true;
  }
  const key = completionKey(runtime, activityId, blockId);
  const state = runtime.completions.getState(key);
  input.checked = state.completed;
  void runtime.completions
    .setCompleted(key, !state.completed)
    .catch(() => runtime.announce("No pudimos guardar el completado."));
  return true;
}

export function toDocumentBlocks(blocks: readonly RitmoBlock[]) {
  return blocks as unknown as DocumentBlock[];
}
