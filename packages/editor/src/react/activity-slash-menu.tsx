import { insertOrUpdateBlockForSlashMenu } from "@blocknote/core/extensions";
import {
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  type DefaultReactSuggestionItem,
} from "@blocknote/react";
import { ListTodo } from "lucide-react";
import { activityDefaults } from "@ritmo/core";

import { isInsideActivity } from "./activity-scope";
import type { RitmoEditor } from "./activity-schema";

function activityItem(editor: RitmoEditor): DefaultReactSuggestionItem {
  return {
    title: "Actividad",
    subtext: "Agrega hora, completion diaria y temporizador.",
    aliases: ["actividad", "timer", "rutina"],
    group: "Ritmo",
    icon: <ListTodo aria-hidden="true" size={18} />,
    onItemClick: () => {
      insertOrUpdateBlockForSlashMenu(editor, {
        type: "activity",
        props: { ...activityDefaults, scheduledTime: "" },
        content: "",
      });
    },
  };
}

function filterItems(items: DefaultReactSuggestionItem[], query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return items;
  return items.filter((item) =>
    [item.title, ...(item.aliases ?? [])].some((candidate) =>
      candidate.toLocaleLowerCase().includes(normalized),
    ),
  );
}

export function ActivitySlashMenu({ editor }: { editor: RitmoEditor }) {
  return (
    <SuggestionMenuController
      getItems={async (query) => {
        const current = editor.getTextCursorPosition().block;
        const defaults = getDefaultReactSlashMenuItems(editor);
        return filterItems(
          isInsideActivity(editor, current.id)
            ? defaults
            : [...defaults, activityItem(editor)],
          query,
        );
      }}
      triggerCharacter="/"
    />
  );
}
