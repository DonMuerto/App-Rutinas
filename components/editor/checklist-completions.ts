import type { MouseEvent as ReactMouseEvent } from "react";

import type { ActivityRuntimeValue } from "./activity-runtime";
import {
  findNearestActivityId,
  getChecklistActivityScopes,
  getChecklistScopeTransitions,
} from "@/lib/blocknote/activity-scope";
import type {
  RitmoBlock,
  RitmoEditor,
} from "@/lib/blocknote/activity-block-spec";
import { getInlinePlainText } from "@/lib/blocknote/inline-text";

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

export function normalizeChecklistScopeTransitions(
  editor: RitmoEditor,
  previousScopes: ReadonlyMap<string, string | undefined>,
) {
  const currentScopes = getChecklistActivityScopes(
    editor.document as RitmoBlock[],
  );
  const transitionedChecklistIds = getChecklistScopeTransitions(
    previousScopes,
    currentScopes,
  );

  editor.transact(() => {
    for (const blockId of transitionedChecklistIds) {
      const block = editor.getBlock(blockId);
      if (block?.type === "checkListItem" && block.props.checked) {
        editor.updateBlock(block, { props: { checked: false } });
      }
    }
  });

  return currentScopes;
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

      const hasStableIds =
        (runtime.canUseBlockId?.(activityId) ?? true) &&
        (runtime.canUseBlockId?.(blockId) ?? true);
      const completed = hasStableIds
        ? runtime.isCompleted(activityId, blockId)
        : false;
      input.checked = completed;
      input.disabled =
        !hasStableIds ||
        (runtime.isCompletionPending?.(activityId, blockId) ?? false);
      const checklistTitle = getInlinePlainText(
        editor.getBlock(blockId)?.content,
      ).trim();
      const activityTitle = getInlinePlainText(
        editor.getBlock(activityId)?.content,
      ).trim();
      input.setAttribute(
        "aria-label",
        `${completed ? "Desmarcar" : "Completar"} ${checklistTitle || "subtarea"} de ${activityTitle || "la actividad"}`,
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
  if (!activityId) {
    return false;
  }

  if (
    runtime.canUseBlockId &&
    (!runtime.canUseBlockId(activityId) || !runtime.canUseBlockId(blockId))
  ) {
    event.preventDefault();
    event.stopPropagation();
    input.checked = false;
    return true;
  }

  event.preventDefault();
  event.stopPropagation();
  const completed = runtime.isCompleted(activityId, blockId);
  input.checked = completed;

  void runtime.toggleCompletion(
    {
      routineId: runtime.routineId,
      scopeActivityBlockId: activityId,
      blockId,
      blockType: "checklist",
      completionDate: runtime.localDate,
    },
    !completed,
  );

  return true;
}
