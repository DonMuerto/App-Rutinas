import { DomainError } from "@ritmo/core";
import { describe, expect, it, vi } from "vitest";

import type { DataClient } from "./client";
import { createRepositories } from "./repositories";

const ROUTINE_ID = "22222222-2222-4222-8222-222222222222";
const COPY_ID = "44444444-4444-4444-8444-444444444444";
const REQUEST_ID = "55555555-5555-4555-8555-555555555555";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "33333333-3333-4333-8333-333333333333";

function routineRow() {
  return {
    id: ROUTINE_ID,
    user_id: USER_ID,
    name: "Noche",
    icon: null,
    recurrence_type: "daily" as const,
    specific_date: null,
    content: {
      schemaVersion: 1,
      blocks: [
        {
          id: "block-1",
          type: "activity",
          children: [{ id: "check-1", type: "checkListItem" }],
        },
      ],
    },
    position: 0,
    revision: 3,
    created_at: "2026-09-18T10:00:00Z",
    updated_at: "2026-09-18T10:00:00Z",
  };
}

function updateClient() {
  const update = vi.fn();
  const query = {
    update: (value: unknown) => {
      update(value);
      return query;
    },
    eq: () => query,
    select: () => query,
    maybeSingle: vi.fn(async () => ({ data: { id: ROUTINE_ID }, error: null })),
  };
  return {
    client: { from: vi.fn(() => query) } as unknown as DataClient,
    update,
  };
}

function casClient(options: { loaded: boolean; revision?: number }) {
  const rpc = vi.fn(async () => ({
    data:
      options.revision === undefined
        ? []
        : [
            {
              new_revision: options.revision,
              new_updated_at: "2026-09-18T10:01:00Z",
            },
          ],
    error: null,
  }));
  const mutationResult = { error: null };
  const mutation = {
    abortSignal: vi.fn(async () => mutationResult),
    then<TResult1 = typeof mutationResult, TResult2 = never>(
      onfulfilled?:
        | ((value: typeof mutationResult) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?:
        ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      return Promise.resolve(mutationResult).then(onfulfilled, onrejected);
    },
  };
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: vi.fn(async () => ({
      data: options.loaded ? routineRow() : null,
      error: null,
    })),
    upsert: vi.fn(() => mutation),
    delete: () => query,
    abortSignal: mutation.abortSignal,
  };
  const getUser = vi.fn(async () => ({
    data: { user: { id: USER_ID } },
    error: null,
  }));
  return {
    client: {
      auth: { getUser },
      from: vi.fn(() => query),
      rpc,
    } as unknown as DataClient,
    getUser,
    query,
    mutation,
    rpc,
  };
}

function draftCopyClient() {
  const document = {
    schemaVersion: 1 as const,
    blocks: [{ id: "draft-block", props: { preserved: true } }],
  };
  const copiedRow = {
    ...routineRow(),
    id: COPY_ID,
    name: "Copia recuperada",
    content: document,
    position: 1,
    revision: 0,
  };
  const rpc = vi.fn(async () => ({ data: COPY_ID, error: null }));
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: vi.fn(async () => ({ data: copiedRow, error: null })),
  };

  return {
    client: {
      from: vi.fn(() => query),
      rpc,
    } as unknown as DataClient,
    document,
    rpc,
  };
}

describe("RoutineRepository", () => {
  it("keeps metadata mutations separate", async () => {
    const { client, update } = updateClient();
    const routines = createRepositories(client).routines;

    await routines.rename(ROUTINE_ID, "  Manana  ");
    await routines.updateRecurrence(ROUTINE_ID, {
      recurrenceType: "specific_date",
      specificDate: "2026-09-19",
    });

    expect(update).toHaveBeenNthCalledWith(1, { name: "Manana" });
    expect(update).toHaveBeenNthCalledWith(2, {
      recurrence_type: "specific_date",
      specific_date: "2026-09-19",
    });
  });

  it("parses the persisted envelope and exposes revision", async () => {
    const { client } = casClient({ loaded: true });
    const routine =
      await createRepositories(client).routines.getById(ROUTINE_ID);

    expect(routine.content).toEqual({
      schemaVersion: 1,
      blocks: [
        {
          id: "block-1",
          type: "activity",
          children: [{ id: "check-1", type: "checkListItem" }],
        },
      ],
    });
    expect(routine.revision).toBe(3);
  });

  it("creates an exact draft copy through the idempotent RPC", async () => {
    const { client, document, rpc } = draftCopyClient();
    const routines = createRepositories(client).routines;

    const copy = await routines.createFromDraft({
      sourceRoutineId: ROUTINE_ID,
      document,
      metadata: {
        name: "  Copia recuperada  ",
        icon: null,
        recurrenceType: "daily",
        specificDate: null,
      },
      requestId: REQUEST_ID,
    });

    expect(rpc).toHaveBeenCalledWith("create_routine_from_draft", {
      source_routine_id: ROUTINE_ID,
      document,
      routine_name: "Copia recuperada",
      routine_icon: null,
      routine_recurrence_type: "daily",
      routine_specific_date: null,
      request_id: REQUEST_ID,
    });
    expect(copy).toMatchObject({
      id: COPY_ID,
      content: document,
      revision: 0,
    });
  });

  it("rejects a non-UUID draft-copy request before calling Supabase", async () => {
    const { client, document, rpc } = draftCopyClient();

    await expect(
      createRepositories(client).routines.createFromDraft({
        sourceRoutineId: ROUTINE_ID,
        document,
        metadata: {
          name: "Copia",
          icon: null,
          recurrenceType: "daily",
          specificDate: null,
        },
        requestId: `${USER_ID}:${ROUTINE_ID}:1`,
      }),
    ).rejects.toMatchObject<Partial<DomainError>>({ code: "VALIDATION" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("saves an envelope with compare-and-swap and returns its new revision", async () => {
    const { client, rpc } = casClient({ loaded: true, revision: 4 });
    const routines = createRepositories(client).routines;
    await routines.getById(ROUTINE_ID);

    await expect(
      routines.saveDocument(ROUTINE_ID, 3, {
        schemaVersion: 1,
        blocks: [{ id: "block-2" }],
      }),
    ).resolves.toBe(4);
    expect(rpc).toHaveBeenCalledWith("save_routine_document", {
      routine_id: ROUTINE_ID,
      expected_revision: 3,
      document: { schemaVersion: 1, blocks: [{ id: "block-2" }] },
    });
  });

  it("reports conflict only after the routine was accessible", async () => {
    const loaded = casClient({ loaded: true });
    const loadedRepository = createRepositories(loaded.client).routines;
    await loadedRepository.getById(ROUTINE_ID);

    await expect(
      loadedRepository.saveDocument(ROUTINE_ID, 3, {
        schemaVersion: 1,
        blocks: [],
      }),
    ).rejects.toMatchObject<Partial<DomainError>>({
      code: "DOCUMENT_CONFLICT",
    });

    const unknown = casClient({ loaded: false });
    await expect(
      createRepositories(unknown.client).routines.saveDocument(ROUTINE_ID, 3, {
        schemaVersion: 1,
        blocks: [],
      }),
    ).rejects.toMatchObject<Partial<DomainError>>({ code: "NOT_FOUND" });
  });

  it("does not reveal a routine loaded by a previous user", async () => {
    const harness = casClient({ loaded: true });
    const routines = createRepositories(harness.client).routines;
    await routines.getById(ROUTINE_ID);
    harness.getUser.mockResolvedValueOnce({
      data: { user: { id: OTHER_USER_ID } },
      error: null,
    });

    await expect(
      routines.saveDocument(ROUTINE_ID, 3, {
        schemaVersion: 1,
        blocks: [],
      }),
    ).rejects.toMatchObject<Partial<DomainError>>({ code: "NOT_FOUND" });
  });

  it("accepts completion IDs only from the loaded routine document", async () => {
    const harness = casClient({ loaded: true });
    const repositories = createRepositories(harness.client);
    await repositories.routines.getById(ROUTINE_ID);

    await expect(
      repositories.completions.mark({
        routineId: ROUTINE_ID,
        scopeActivityBlockId: "block-1",
        blockId: "block-1",
        blockType: "activity",
        completionDate: "2026-09-18",
      }),
    ).resolves.toBeUndefined();
    await expect(
      repositories.completions.mark({
        routineId: ROUTINE_ID,
        scopeActivityBlockId: "block-1",
        blockId: "check-1",
        blockType: "checklist",
        completionDate: "2026-09-18",
      }),
    ).resolves.toBeUndefined();
    await expect(
      repositories.completions.mark({
        routineId: ROUTINE_ID,
        scopeActivityBlockId: "fabricated",
        blockId: "fabricated",
        blockType: "activity",
        completionDate: "2026-09-18",
      }),
    ).rejects.toMatchObject<Partial<DomainError>>({ code: "VALIDATION" });
    await expect(
      repositories.completions.mark({
        routineId: ROUTINE_ID,
        scopeActivityBlockId: "check-1",
        blockId: "check-1",
        blockType: "activity",
        completionDate: "2026-09-18",
      }),
    ).rejects.toMatchObject<Partial<DomainError>>({ code: "VALIDATION" });
    expect(harness.query.upsert).toHaveBeenCalledTimes(2);
  });

  it("forwards cancellation to completion mutations", async () => {
    const harness = casClient({ loaded: true });
    const repositories = createRepositories(harness.client);
    await repositories.routines.getById(ROUTINE_ID);
    const controller = new AbortController();

    await repositories.completions.mark(
      {
        routineId: ROUTINE_ID,
        scopeActivityBlockId: "block-1",
        blockId: "block-1",
        blockType: "activity",
        completionDate: "2026-09-18",
      },
      controller.signal,
    );

    expect(harness.mutation.abortSignal).toHaveBeenCalledWith(
      controller.signal,
    );
  });
});
