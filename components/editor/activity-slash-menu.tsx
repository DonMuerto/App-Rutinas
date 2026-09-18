"use client";

import { ListTodo } from "lucide-react";
import {
  filterSuggestionItems,
  insertOrUpdateBlockForSlashMenu,
} from "@blocknote/core/extensions";
import {
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  type DefaultReactSuggestionItem,
} from "@blocknote/react";

import { activityDefaults } from "@/lib/contracts";
import { isInsideActivity } from "@/lib/blocknote/activity-scope";
import type { RitmoEditor } from "@/lib/blocknote/activity-block-spec";

function getActivityItem(editor: RitmoEditor): DefaultReactSuggestionItem {
  return {
    title: "Actividad",
    subtext: "Agrega hora, completion diaria y temporizador.",
    aliases: ["actividad", "timer", "rutina"],
    group: "Ritmo",
    icon: <ListTodo aria-hidden="true" size={18} />,
    onItemClick: () => {
      insertOrUpdateBlockForSlashMenu(editor, {
        type: "activity",
        props: activityDefaults,
        content: "",
      });
    },
  };
}

export function ActivitySlashMenu({
  editor,
}: {
  readonly editor: RitmoEditor;
}) {
  return (
    <SuggestionMenuController
      getItems={async (query) => {
        const currentBlock = editor.getTextCursorPosition().block;
        const defaults = getDefaultReactSlashMenuItems(editor);
        const items = isInsideActivity(editor, currentBlock.id)
          ? defaults
          : [...defaults, getActivityItem(editor)];

        return filterSuggestionItems(items, query);
      }}
      triggerCharacter="/"
    />
  );
}
