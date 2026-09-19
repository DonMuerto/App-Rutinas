import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { activityDefaults } from "@ritmo/core";

import { ActivityBlock, type ActivityBlockProps } from "./activity-block";

export const activityPropSchema = {
  schemaVersion: { default: activityDefaults.schemaVersion },
  scheduledTime: { default: "" },
  timerType: { default: activityDefaults.timerType },
  countdownSeconds: { default: activityDefaults.countdownSeconds },
  prepareSeconds: { default: activityDefaults.prepareSeconds },
  workSeconds: { default: activityDefaults.workSeconds },
  restSeconds: { default: activityDefaults.restSeconds },
  cycles: { default: activityDefaults.cycles },
  sets: { default: activityDefaults.sets },
  restBetweenSetsSeconds: {
    default: activityDefaults.restBetweenSetsSeconds,
  },
} as const;

export const activityBlockConfig = {
  type: "activity",
  propSchema: activityPropSchema,
  content: "inline",
} as const;

export const activityBlockSpec = createReactBlockSpec(activityBlockConfig, {
  meta: { isolating: false },
  render: (props) => <ActivityBlock {...(props as ActivityBlockProps)} />,
  toExternalHTML: (props) => (
    <p data-activity="true" ref={(props as ActivityBlockProps).contentRef} />
  ),
})();

export const ritmoSchema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph: defaultBlockSpecs.paragraph,
    heading: defaultBlockSpecs.heading,
    bulletListItem: defaultBlockSpecs.bulletListItem,
    numberedListItem: defaultBlockSpecs.numberedListItem,
    checkListItem: defaultBlockSpecs.checkListItem,
    quote: defaultBlockSpecs.quote,
    divider: defaultBlockSpecs.divider,
    activity: activityBlockSpec,
  },
});

export type RitmoEditor = typeof ritmoSchema.BlockNoteEditor;
export type RitmoBlock = typeof ritmoSchema.Block;
export type RitmoPartialBlock = typeof ritmoSchema.PartialBlock;
