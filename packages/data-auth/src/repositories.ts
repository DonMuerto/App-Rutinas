import {
  completionKeySchema,
  DomainError,
  localDateSchema,
  routineDocumentSchema,
  routineMetadataSchema,
  routineNameSchema,
  routineRecurrenceSchema,
  routineSchema,
  type CompletionKey,
  type JsonValue,
  type Routine,
  type RoutineDocument,
} from "@ritmo/core";

import type { DataClient } from "./client";
import type { Database } from "./database.types";
import { dataError, inaccessibleResource, invalidDocument } from "./errors";
import type {
  BlockCompletion,
  CompletionRepository,
  CreateRoutineFromDraftInput,
  CreateRoutineInput,
  Repositories,
  RoutineRecurrence,
  RoutineRepository,
} from "./types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RoutineRow = Database["public"]["Tables"]["routines"]["Row"];
type RoutineMetadataRow = Pick<
  RoutineRow,
  "id" | "name" | "icon" | "position" | "recurrence_type" | "specific_date"
>;
type CompletionRow = Database["public"]["Tables"]["block_completions"]["Row"];

interface RuntimeSchema<T> {
  safeParse(
    value: unknown,
  ): { success: true; data: T } | { success: false; error: unknown };
}

function parseInput<T>(schema: RuntimeSchema<T>, value: unknown): T {
  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    throw dataError(parsed.error);
  }

  return parsed.data;
}

function parseUuid(value: string) {
  if (!UUID_PATTERN.test(value)) {
    throw new DomainError("VALIDATION", "El ID de rutina no es valido.");
  }

  return value;
}

function parseRequestId(value: string) {
  if (!UUID_PATTERN.test(value)) {
    throw new DomainError("VALIDATION", "El requestId no es un UUID valido.");
  }

  return value;
}

function parseRevision(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DomainError("VALIDATION", "La revision esperada no es valida.");
  }

  return value;
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
    throw invalidDocument(parsed.error);
  }

  return parsed.data;
}

function parseDocument(value: JsonValue): RoutineDocument {
  const parsed = routineDocumentSchema.safeParse(value);

  if (!parsed.success) {
    throw invalidDocument(parsed.error);
  }

  return parsed.data;
}

function mapRoutine(row: RoutineRow) {
  const parsed = routineSchema.safeParse({
    ...mapRoutineMetadata(row),
    content: parseDocument(row.content),
    revision: row.revision,
  });

  if (!parsed.success) {
    throw invalidDocument(parsed.error);
  }

  return parsed.data;
}

function mapCompletion(row: CompletionRow): BlockCompletion {
  const completion = completionKeySchema.safeParse({
    routineId: row.routine_id,
    scopeActivityBlockId: row.scope_activity_block_id,
    blockId: row.block_id,
    blockType: row.block_type,
    completionDate: row.completion_date,
  });

  if (
    !completion.success ||
    !UUID_PATTERN.test(row.id) ||
    !Number.isFinite(Date.parse(row.completed_at))
  ) {
    throw invalidDocument(
      completion.success
        ? new TypeError("Invalid completion row.")
        : completion.error,
    );
  }

  return {
    ...completion.data,
    id: row.id,
    completedAt: row.completed_at,
  };
}

function jsonValue(value: unknown): JsonValue {
  try {
    const serialized = JSON.stringify(value);

    if (serialized === undefined) {
      throw new TypeError("Value is not JSON serializable.");
    }

    return JSON.parse(serialized) as JsonValue;
  } catch (error) {
    throw invalidDocument(error);
  }
}

interface LoadedRoutineContext {
  userId: string;
  completionTargets: ReadonlyMap<
    string,
    { blockType: "activity" | "checklist"; scopeActivityBlockId: string }
  >;
}

function documentCompletionTargets(document: RoutineDocument) {
  const counts = new Map<string, number>();

  const visit = (blocks: readonly unknown[]) => {
    for (const candidate of blocks) {
      if (typeof candidate !== "object" || candidate === null) continue;
      const block = candidate as Record<string, unknown>;
      if (typeof block.id === "string" && block.id.length > 0) {
        counts.set(block.id, (counts.get(block.id) ?? 0) + 1);
      }
      if (Array.isArray(block.children)) visit(block.children);
    }
  };

  visit(document.blocks);
  const targets = new Map<
    string,
    { blockType: "activity" | "checklist"; scopeActivityBlockId: string }
  >();

  const collect = (
    blocks: readonly unknown[],
    activityScope: string | undefined,
  ) => {
    for (const candidate of blocks) {
      if (typeof candidate !== "object" || candidate === null) continue;
      const block = candidate as Record<string, unknown>;
      const id =
        typeof block.id === "string" && counts.get(block.id) === 1
          ? block.id
          : undefined;
      const childScope = block.type === "activity" ? id : activityScope;

      if (block.type === "activity" && id) {
        targets.set(id, {
          blockType: "activity",
          scopeActivityBlockId: id,
        });
      } else if (block.type === "checkListItem" && id && activityScope) {
        targets.set(id, {
          blockType: "checklist",
          scopeActivityBlockId: activityScope,
        });
      }

      if (Array.isArray(block.children)) collect(block.children, childScope);
    }
  };

  collect(document.blocks, undefined);
  return targets;
}

async function isCurrentUser(
  client: DataClient,
  expectedUserId: string,
): Promise<boolean> {
  const { data, error } = await client.auth.getUser();
  if (error) throw dataError(error);
  return data.user?.id === expectedUserId;
}

function createRoutineRepository(
  client: DataClient,
  loadedRoutines: Map<string, LoadedRoutineContext>,
): RoutineRepository {
  function rememberRoutine(row: RoutineRow, routine: Routine) {
    loadedRoutines.set(row.id, {
      userId: row.user_id,
      completionTargets: documentCompletionTargets(routine.content),
    });
  }

  async function updatePartial(
    id: string,
    values: Database["public"]["Tables"]["routines"]["Update"],
  ) {
    const routineId = parseUuid(id);
    const { data, error } = await client
      .from("routines")
      .update(values)
      .eq("id", routineId)
      .select("id")
      .maybeSingle();

    if (error) throw dataError(error);
    if (!data) throw inaccessibleResource();
  }

  async function getById(id: string) {
    const routineId = parseUuid(id);
    const { data, error } = await client
      .from("routines")
      .select("*")
      .eq("id", routineId)
      .maybeSingle();

    if (error) throw dataError(error);
    if (!data) throw inaccessibleResource();

    const routine = mapRoutine(data);
    rememberRoutine(data, routine);
    return routine;
  }

  return {
    async listMetadata() {
      const { data, error } = await client
        .from("routines")
        .select("id, name, icon, recurrence_type, specific_date, position")
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw dataError(error);
      return data.map(mapRoutineMetadata);
    },

    getById,

    async create(input: CreateRoutineInput) {
      const recurrence = parseInput(routineRecurrenceSchema, input);
      const name = parseInput(routineNameSchema, input.name);
      const icon = input.icon ?? null;

      if (typeof icon !== "string" && icon !== null) {
        throw new DomainError("VALIDATION", "El icono de rutina no es valido.");
      }

      const { data, error } = await client.rpc("create_routine", {
        routine_name: name,
        routine_icon: icon,
        routine_recurrence_type: recurrence.recurrenceType,
        routine_specific_date: recurrence.specificDate,
      });

      if (error) throw dataError(error);
      return getById(data);
    },

    async createFromDraft(input: CreateRoutineFromDraftInput) {
      const sourceRoutineId = parseUuid(input.sourceRoutineId);
      const requestId = parseRequestId(input.requestId);
      const document = parseInput(routineDocumentSchema, input.document);
      const recurrence = parseInput(routineRecurrenceSchema, input.metadata);
      const name = parseInput(routineNameSchema, input.metadata.name);
      const icon = input.metadata.icon;

      if (typeof icon !== "string" && icon !== null) {
        throw new DomainError("VALIDATION", "El icono de rutina no es valido.");
      }

      const { data, error } = await client.rpc("create_routine_from_draft", {
        source_routine_id: sourceRoutineId,
        document: jsonValue(document),
        routine_name: name,
        routine_icon: icon,
        routine_recurrence_type: recurrence.recurrenceType,
        routine_specific_date: recurrence.specificDate,
        request_id: requestId,
      });

      if (error) throw dataError(error);
      if (!data) throw inaccessibleResource();
      return getById(data);
    },

    async rename(id, name) {
      await updatePartial(id, { name: parseInput(routineNameSchema, name) });
    },

    async updateIcon(id, icon) {
      if (typeof icon !== "string" && icon !== null) {
        throw new DomainError("VALIDATION", "El icono de rutina no es valido.");
      }
      await updatePartial(id, { icon });
    },

    async updateRecurrence(id, recurrence: RoutineRecurrence) {
      const parsed = parseInput(routineRecurrenceSchema, recurrence);
      await updatePartial(id, {
        recurrence_type: parsed.recurrenceType,
        specific_date: parsed.specificDate,
      });
    },

    async saveDocument(id, expectedRevision, content) {
      const routineId = parseUuid(id);
      const revision = parseRevision(expectedRevision);
      const document = parseInput(routineDocumentSchema, content);
      const { data, error } = await client.rpc("save_routine_document", {
        routine_id: routineId,
        expected_revision: revision,
        document: jsonValue(document),
      });

      if (error) throw dataError(error);

      const result = data[0];
      if (!result) {
        const loaded = loadedRoutines.get(routineId);
        if (loaded && (await isCurrentUser(client, loaded.userId))) {
          throw new DomainError(
            "DOCUMENT_CONFLICT",
            "La rutina cambio en otro contexto. Tu borrador se conserva.",
          );
        }
        throw inaccessibleResource();
      }

      const loaded = loadedRoutines.get(routineId);
      if (loaded) {
        loadedRoutines.set(routineId, {
          ...loaded,
          completionTargets: documentCompletionTargets(document),
        });
      }

      return result.new_revision;
    },

    async reorder(orderedIds) {
      const ids = orderedIds.map(parseUuid);
      if (new Set(ids).size !== ids.length) {
        throw new DomainError(
          "VALIDATION",
          "La lista de rutinas no puede contener IDs duplicados.",
        );
      }

      const { error } = await client.rpc("reorder_routines", {
        ordered_ids: ids,
      });
      if (error) throw dataError(error);
    },

    async delete(id) {
      const routineId = parseUuid(id);
      const { data, error } = await client
        .from("routines")
        .delete()
        .eq("id", routineId)
        .select("id")
        .maybeSingle();

      if (error) throw dataError(error);
      if (!data) throw inaccessibleResource();
      loadedRoutines.delete(routineId);
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

      if (error) throw dataError(error);
      return data.map((row) => {
        const routine = mapRoutine(row);
        rememberRoutine(row, routine);
        return routine;
      });
    },
  };
}

function createCompletionRepository(
  client: DataClient,
  loadedRoutines: Map<string, LoadedRoutineContext>,
): CompletionRepository {
  async function validateProvenance(completion: CompletionKey) {
    const loaded = loadedRoutines.get(completion.routineId);
    if (!loaded || !(await isCurrentUser(client, loaded.userId))) {
      throw inaccessibleResource();
    }

    const target = loaded.completionTargets.get(completion.blockId);
    if (
      !target ||
      target.blockType !== completion.blockType ||
      target.scopeActivityBlockId !== completion.scopeActivityBlockId
    ) {
      throw new DomainError(
        "VALIDATION",
        "La completion no pertenece al documento cargado.",
      );
    }
  }

  return {
    async list(routineIds, completionDate) {
      const ids = routineIds.map(parseUuid);
      const date = parseInput(localDateSchema, completionDate);
      if (ids.length === 0) return [];

      const { data, error } = await client
        .from("block_completions")
        .select("*")
        .in("routine_id", ids)
        .eq("completion_date", date);

      if (error) throw dataError(error);
      return data.map(mapCompletion);
    },

    async mark(completion, signal) {
      const parsed = parseInput(completionKeySchema, completion);
      await validateProvenance(parsed);
      const mutation = client.from("block_completions").upsert(
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
      const { error } = await (signal
        ? mutation.abortSignal(signal)
        : mutation);
      if (error) throw dataError(error);
    },

    async unmark(completion, signal) {
      const parsed = parseInput(completionKeySchema, completion);
      await validateProvenance(parsed);
      const mutation = client
        .from("block_completions")
        .delete()
        .eq("routine_id", parsed.routineId)
        .eq("scope_activity_block_id", parsed.scopeActivityBlockId)
        .eq("block_id", parsed.blockId)
        .eq("completion_date", parsed.completionDate);
      const { error } = await (signal
        ? mutation.abortSignal(signal)
        : mutation);
      if (error) throw dataError(error);
    },
  };
}

export function createRepositoryServices(client: DataClient) {
  const loadedRoutines = new Map<string, LoadedRoutineContext>();
  const repositories: Repositories = {
    routines: createRoutineRepository(client, loadedRoutines),
    completions: createCompletionRepository(client, loadedRoutines),
  };

  return {
    repositories,
    clearUserData(userId: string) {
      for (const [routineId, context] of loadedRoutines) {
        if (context.userId === userId) loadedRoutines.delete(routineId);
      }
    },
  };
}

export function createRepositories(client: DataClient): Repositories {
  return createRepositoryServices(client).repositories;
}
