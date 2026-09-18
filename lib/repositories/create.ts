import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  completionKeySchema,
  DomainError,
  localDateSchema,
  routineDocumentSchema,
  routineMetadataSchema,
  routineNameSchema,
  routineRecurrenceSchema,
  routineSchema,
} from "@/lib/contracts";
import type { Database, Json } from "@/lib/supabase/database.types";

import {
  inaccessibleResource,
  invalidPersistedRoutine,
  repositoryError,
} from "./errors";
import type {
  BlockCompletion,
  CompletionRepository,
  CreateRoutineInput,
  Repositories,
  RoutineRecurrence,
  RoutineRepository,
} from "./types";

const uuidSchema = z.uuid();
const createRoutineSchema = routineRecurrenceSchema.and(
  z.object({
    name: routineNameSchema,
    icon: z.string().nullable().optional(),
  }),
);
const routineIdsSchema = z.array(z.uuid());
const routineIconSchema = z.string().nullable();
const persistedCompletionSchema = completionKeySchema.and(
  z.object({
    id: z.uuid(),
    completedAt: z.iso.datetime({ offset: true }),
  }),
);

type RoutineRow = Database["public"]["Tables"]["routines"]["Row"];
type RoutineMetadataRow = Pick<
  RoutineRow,
  "id" | "name" | "icon" | "position" | "recurrence_type" | "specific_date"
>;
type CompletionRow = Database["public"]["Tables"]["block_completions"]["Row"];

function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    throw repositoryError(parsed.error);
  }

  return parsed.data;
}

function mapRoutineMetadata(row: RoutineMetadataRow) {
  const parsed = routineMetadataSchema.safeParse({
    id: row.id,
    name: row.name,
    icon: row.icon,
    position: row.position,
    recurrenceType: row.recurrence_type,
    specificDate: row.specific_date,
  });

  if (!parsed.success) {
    throw invalidPersistedRoutine(parsed.error);
  }

  return parsed.data;
}

function mapRoutine(row: RoutineRow) {
  const parsed = routineSchema.safeParse({
    ...mapRoutineMetadata(row),
    content: row.content,
  });

  if (!parsed.success) {
    throw invalidPersistedRoutine(parsed.error);
  }

  return parsed.data;
}

function mapCompletion(row: CompletionRow): BlockCompletion {
  const parsed = persistedCompletionSchema.safeParse({
    id: row.id,
    routineId: row.routine_id,
    scopeActivityBlockId: row.scope_activity_block_id,
    blockId: row.block_id,
    blockType: row.block_type,
    completionDate: row.completion_date,
    completedAt: row.completed_at,
  });

  if (!parsed.success) {
    throw invalidPersistedRoutine(parsed.error);
  }

  return parsed.data;
}

function asJsonDocument(content: unknown): Json {
  try {
    const serialized = JSON.stringify(content);

    if (serialized === undefined) {
      throw new TypeError("Document is not JSON serializable.");
    }

    return JSON.parse(serialized) as Json;
  } catch (error) {
    throw invalidPersistedRoutine(error);
  }
}

function createRoutineRepository(
  client: SupabaseClient<Database>,
): RoutineRepository {
  async function updatePartial(
    id: string,
    values: Database["public"]["Tables"]["routines"]["Update"],
  ) {
    const routineId = parseInput(uuidSchema, id);
    const { data, error } = await client
      .from("routines")
      .update(values)
      .eq("id", routineId)
      .select("id")
      .maybeSingle();

    if (error) {
      throw repositoryError(error);
    }

    if (!data) {
      throw inaccessibleResource();
    }
  }

  async function getById(id: string) {
    const routineId = parseInput(uuidSchema, id);
    const { data, error } = await client
      .from("routines")
      .select("*")
      .eq("id", routineId)
      .maybeSingle();

    if (error) {
      throw repositoryError(error);
    }

    if (!data) {
      throw inaccessibleResource();
    }

    return mapRoutine(data);
  }

  return {
    async listMetadata() {
      const { data, error } = await client
        .from("routines")
        .select("id, name, icon, recurrence_type, specific_date, position")
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) {
        throw repositoryError(error);
      }

      return data.map(mapRoutineMetadata);
    },

    getById,

    async create(input: CreateRoutineInput) {
      const parsed = parseInput(createRoutineSchema, input);
      const { data, error } = await client.rpc("create_routine", {
        routine_name: parsed.name,
        routine_icon: parsed.icon ?? null,
        routine_recurrence_type: parsed.recurrenceType,
        routine_specific_date: parsed.specificDate,
      });

      if (error) {
        throw repositoryError(error);
      }

      return getById(data);
    },

    async rename(id, name) {
      await updatePartial(id, { name: parseInput(routineNameSchema, name) });
    },

    async updateIcon(id, icon) {
      await updatePartial(id, { icon: parseInput(routineIconSchema, icon) });
    },

    async updateRecurrence(id, recurrence: RoutineRecurrence) {
      const parsed = parseInput(routineRecurrenceSchema, recurrence);
      await updatePartial(id, {
        recurrence_type: parsed.recurrenceType,
        specific_date: parsed.specificDate,
      });
    },

    async saveDocument(id, content) {
      const document = parseInput(routineDocumentSchema, content);
      await updatePartial(id, { content: asJsonDocument(document) });
    },

    async reorder(orderedIds) {
      const ids = parseInput(routineIdsSchema, orderedIds);

      if (new Set(ids).size !== ids.length) {
        throw new DomainError(
          "VALIDATION",
          "La lista de rutinas no puede contener IDs duplicados.",
        );
      }

      const { error } = await client.rpc("reorder_routines", {
        ordered_ids: ids,
      });

      if (error) {
        throw repositoryError(error);
      }
    },

    async delete(id) {
      const routineId = parseInput(uuidSchema, id);
      const { data, error } = await client
        .from("routines")
        .delete()
        .eq("id", routineId)
        .select("id")
        .maybeSingle();

      if (error) {
        throw repositoryError(error);
      }

      if (!data) {
        throw inaccessibleResource();
      }
    },

    async listForDate(date) {
      const localDate = parseInput(localDateSchema, date);
      const { data, error } = await client
        .from("routines")
        .select("*")
        .or(
          `recurrence_type.eq.daily,and(recurrence_type.eq.specific_date,specific_date.eq.${localDate})`,
        )
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) {
        throw repositoryError(error);
      }

      return data.map(mapRoutine);
    },
  };
}

function createCompletionRepository(
  client: SupabaseClient<Database>,
): CompletionRepository {
  return {
    async list(routineIds, completionDate) {
      const ids = parseInput(routineIdsSchema, routineIds);
      const date = parseInput(localDateSchema, completionDate);

      if (ids.length === 0) {
        return [];
      }

      const { data, error } = await client
        .from("block_completions")
        .select("*")
        .in("routine_id", ids)
        .eq("completion_date", date);

      if (error) {
        throw repositoryError(error);
      }

      return data.map(mapCompletion);
    },

    async mark(completion) {
      const parsed = parseInput(completionKeySchema, completion);
      const { error } = await client.from("block_completions").upsert(
        {
          routine_id: parsed.routineId,
          scope_activity_block_id: parsed.scopeActivityBlockId,
          block_id: parsed.blockId,
          block_type: parsed.blockType,
          completion_date: parsed.completionDate,
        },
        {
          onConflict:
            "routine_id,scope_activity_block_id,block_id,completion_date",
          ignoreDuplicates: true,
        },
      );

      if (error) {
        throw repositoryError(error);
      }
    },

    async unmark(completion) {
      const parsed = parseInput(completionKeySchema, completion);
      const { error } = await client
        .from("block_completions")
        .delete()
        .eq("routine_id", parsed.routineId)
        .eq("scope_activity_block_id", parsed.scopeActivityBlockId)
        .eq("block_id", parsed.blockId)
        .eq("completion_date", parsed.completionDate);

      if (error) {
        throw repositoryError(error);
      }
    },
  };
}

export function createRepositories(
  client: SupabaseClient<Database>,
): Repositories {
  return {
    routines: createRoutineRepository(client),
    completions: createCompletionRepository(client),
  };
}
