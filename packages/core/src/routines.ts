import { z } from "zod";

import { localDateSchema } from "./dates";

export const routineNameSchema = z
  .string()
  .trim()
  .min(1, "El nombre de la rutina no puede estar vacio.");

export const routineRecurrenceSchema = z.discriminatedUnion("recurrenceType", [
  z.object({
    recurrenceType: z.literal("daily"),
    specificDate: z.null(),
  }),
  z.object({
    recurrenceType: z.literal("specific_date"),
    specificDate: localDateSchema,
  }),
]);

export const ROUTINE_DOCUMENT_SCHEMA_VERSION = 1 as const;

// M2 owns validation of each BlockNote block; core only protects the envelope.
export const routineDocumentSchema = z
  .object({
    schemaVersion: z.literal(ROUTINE_DOCUMENT_SCHEMA_VERSION),
    blocks: z.array(z.json()),
  })
  .strict();

export const routineMetadataSchema = z
  .object({
    id: z.uuid(),
    name: routineNameSchema,
    icon: z.string().nullable(),
    position: z.number().finite().int().nonnegative(),
  })
  .and(routineRecurrenceSchema);

export const routineSchema = routineMetadataSchema.and(
  z.object({
    content: routineDocumentSchema,
    revision: z.number().finite().int().nonnegative(),
  }),
);

export type RoutineDocument = z.infer<typeof routineDocumentSchema>;
export type RoutineMetadata = z.infer<typeof routineMetadataSchema>;
export type Routine = z.infer<typeof routineSchema>;
