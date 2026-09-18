import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";

import { ActivityBlock } from "@/components/editor/activity-block";
import {
  activityBlockConfig,
  activityPropSchema,
} from "@/lib/blocknote/activity-block-config";

export { activityBlockConfig, activityPropSchema };

export const activityBlockSpec = createReactBlockSpec(activityBlockConfig, {
  meta: { isolating: false },
  render: (props) => <ActivityBlock {...props} />,
  toExternalHTML: ({ contentRef }) => (
    <p data-activity="true" ref={contentRef} />
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
