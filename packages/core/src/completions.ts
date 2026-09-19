import { z } from "zod";

import { localDateSchema } from "./dates";

const blockIdSchema = z.string().min(1);

export const completionKeySchema = z
  .object({
    routineId: z.uuid(),
    scopeActivityBlockId: blockIdSchema,
    blockId: blockIdSchema,
    blockType: z.enum(["activity", "checklist"]),
    completionDate: localDateSchema,
  })
  .superRefine((completion, context) => {
    if (
      completion.blockType === "activity" &&
      completion.scopeActivityBlockId !== completion.blockId
    ) {
      context.addIssue({
        code: "custom",
        message: "Una Activity debe ser su propio ambito de completion.",
        path: ["scopeActivityBlockId"],
      });
    }
  });

export type CompletionKey = z.infer<typeof completionKeySchema>;
