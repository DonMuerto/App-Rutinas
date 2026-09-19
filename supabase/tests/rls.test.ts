// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  createSupabaseDataClient,
  type DataClient,
} from "../../packages/data-auth/src/client";

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const runRlsTests = process.env.RUN_SUPABASE_RLS_TESTS === "1";
const isLoopback = (() => {
  if (!url) {
    return false;
  }

  try {
    const hostname = new URL(url).hostname;
    return hostname === "127.0.0.1" || hostname === "localhost";
  } catch {
    return false;
  }
})();

if (runRlsTests && (!url || !anonKey || !isLoopback)) {
  throw new Error(
    "RLS tests require explicit VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY values pointing to loopback.",
  );
}

const describeWithLocalSupabase = runRlsTests ? describe : describe.skip;
const password = "Rls-test-2026";

function anonymousClient() {
  if (!url || !anonKey) {
    throw new Error("Supabase local test environment is not configured.");
  }

  const values = new Map<string, string>();
  return createSupabaseDataClient(
    { url, anonKey },
    {
      async get(key) {
        return values.get(key) ?? null;
      },
      async set(key, value) {
        values.set(key, value);
      },
      async remove(key) {
        values.delete(key);
      },
    },
  );
}

async function authenticatedClient(label: string) {
  const client = anonymousClient();
  const email = `rls-${label}-${crypto.randomUUID()}@ritmo.local`;
  const { data, error } = await client.auth.signUp({ email, password });

  expect(error).toBeNull();
  expect(data.session).not.toBeNull();
  expect(data.user).not.toBeNull();

  if (!data.user) {
    throw new Error("The local auth server did not create a user.");
  }

  return { client, email, userId: data.user.id };
}

async function insertRoutine(
  client: DataClient,
  userId: string,
  name: string,
  position: number,
) {
  const { data, error } = await client
    .from("routines")
    .insert({
      user_id: userId,
      name,
      recurrence_type: "daily",
      specific_date: null,
      position,
      content: { schemaVersion: 1, blocks: [] },
    })
    .select("id")
    .single();

  expect(error).toBeNull();
  expect(data).not.toBeNull();

  if (!data) {
    throw new Error("Routine insert did not return a row.");
  }

  return data.id;
}

describeWithLocalSupabase("RLS through real Data API sessions", () => {
  it("isolates SELECT, INSERT, UPDATE and DELETE for routines and completions", async () => {
    const anon = anonymousClient();
    const userA = await authenticatedClient("a");
    const userB = await authenticatedClient("b");

    const { data: restoredUser, error: restoreError } =
      await userB.client.auth.getUser();
    expect(restoreError).toBeNull();
    expect(restoredUser.user?.id).toBe(userB.userId);

    const { error: logoutError } = await userB.client.auth.signOut();
    expect(logoutError).toBeNull();
    const { data: loggedOutUser } = await userB.client.auth.getUser();
    expect(loggedOutUser.user).toBeNull();

    const { data: loginData, error: loginError } =
      await userB.client.auth.signInWithPassword({
        email: userB.email,
        password,
      });
    expect(loginError).toBeNull();
    expect(loginData.user?.id).toBe(userB.userId);

    const routineA = await insertRoutine(
      userA.client,
      userA.userId,
      "A one",
      0,
    );
    const routineASecond = await insertRoutine(
      userA.client,
      userA.userId,
      "A two",
      1,
    );
    const routineADelete = await insertRoutine(
      userA.client,
      userA.userId,
      "A delete",
      2,
    );
    const routineB = await insertRoutine(
      userB.client,
      userB.userId,
      "B one",
      0,
    );

    const { data: selectedByA, error: selectAError } = await userA.client
      .from("routines")
      .select("id")
      .eq("id", routineA)
      .single();
    expect(selectAError).toBeNull();
    expect(selectedByA?.id).toBe(routineA);

    const { data: ownRoutineB, error: ownRoutineBSelectError } =
      await userB.client
        .from("routines")
        .select("id")
        .eq("id", routineB)
        .single();
    expect(ownRoutineBSelectError).toBeNull();
    expect(ownRoutineB?.id).toBe(routineB);

    const { data: selectedByB, error: selectBError } = await userB.client
      .from("routines")
      .select("id")
      .eq("id", routineA);
    expect(selectBError).toBeNull();
    expect(selectedByB).toEqual([]);

    const { error: foreignRoutineInsert } = await userB.client
      .from("routines")
      .insert({
        user_id: userA.userId,
        name: "Foreign",
        recurrence_type: "daily",
        specific_date: null,
        position: 99,
      });
    expect(foreignRoutineInsert).not.toBeNull();

    const { data: foreignRoutineUpdate, error: foreignUpdateError } =
      await userB.client
        .from("routines")
        .update({ name: "Leaked" })
        .eq("id", routineA)
        .select("id");
    expect(foreignUpdateError).toBeNull();
    expect(foreignRoutineUpdate).toEqual([]);

    const { data: foreignRoutineDelete, error: foreignDeleteError } =
      await userB.client
        .from("routines")
        .delete()
        .eq("id", routineA)
        .select("id");
    expect(foreignDeleteError).toBeNull();
    expect(foreignRoutineDelete).toEqual([]);

    const { error: ownRoutineUpdate } = await userA.client
      .from("routines")
      .update({ name: "A renamed" })
      .eq("id", routineA);
    expect(ownRoutineUpdate).toBeNull();

    const { error: ownRoutineDelete } = await userA.client
      .from("routines")
      .delete()
      .eq("id", routineADelete);
    expect(ownRoutineDelete).toBeNull();

    const { error: invalidRecurrence } = await userA.client
      .from("routines")
      .insert({
        user_id: userA.userId,
        name: "Invalid recurrence",
        recurrence_type: "daily",
        specific_date: "2026-09-13",
        position: 10,
      });
    expect(invalidRecurrence).not.toBeNull();

    const { error: spoofRoutineAudit } = await userA.client
      .from("routines")
      .insert({
        user_id: userA.userId,
        name: "Spoof audit",
        recurrence_type: "daily",
        specific_date: null,
        position: 10,
        created_at: "2000-01-01T00:00:00Z",
      });
    expect(spoofRoutineAudit).not.toBeNull();

    const { error: overwriteRoutineAudit } = await userA.client
      .from("routines")
      .update({ created_at: "2000-01-01T00:00:00Z" })
      .eq("id", routineA);
    expect(overwriteRoutineAudit).not.toBeNull();

    const { error: directDocumentUpdate } = await userA.client
      .from("routines")
      .update({
        content: {
          schemaVersion: 1,
          blocks: [{ id: "direct-write-must-fail" }],
        },
      })
      .eq("id", routineA);
    expect(directDocumentUpdate).not.toBeNull();

    const { error: directRevisionUpdate } = await userA.client
      .from("routines")
      .update({ revision: 99 })
      .eq("id", routineA);
    expect(directRevisionUpdate).not.toBeNull();

    const firstDocument = {
      schemaVersion: 1 as const,
      blocks: [
        {
          id: "activity-a",
          type: "activity",
          children: [{ id: "check-a", type: "checkListItem" }],
        },
      ],
    };
    const { data: firstSave, error: firstSaveError } = await userA.client.rpc(
      "save_routine_document",
      {
        routine_id: routineA,
        expected_revision: 0,
        document: firstDocument,
      },
    );
    expect(firstSaveError).toBeNull();
    expect(firstSave).toHaveLength(1);
    expect(firstSave?.[0]?.new_revision).toBe(1);

    const { data: staleSave, error: staleSaveError } = await userA.client.rpc(
      "save_routine_document",
      {
        routine_id: routineA,
        expected_revision: 0,
        document: { schemaVersion: 1, blocks: [{ id: "stale" }] },
      },
    );
    expect(staleSaveError).toBeNull();
    expect(staleSave).toEqual([]);

    const { data: identicalSave, error: identicalSaveError } =
      await userA.client.rpc("save_routine_document", {
        routine_id: routineA,
        expected_revision: 1,
        document: firstDocument,
      });
    expect(identicalSaveError).toBeNull();
    expect(identicalSave?.[0]?.new_revision).toBe(2);

    const { data: savedRoutine, error: savedRoutineError } =
      await userA.client
        .from("routines")
        .select("content, revision")
        .eq("id", routineA)
        .single();
    expect(savedRoutineError).toBeNull();
    expect(savedRoutine).toEqual({ content: firstDocument, revision: 2 });

    const { data: foreignSave, error: foreignSaveError } =
      await userB.client.rpc("save_routine_document", {
        routine_id: routineA,
        expected_revision: 2,
        document: { schemaVersion: 1, blocks: [] },
      });
    expect(foreignSaveError).toBeNull();
    expect(foreignSave).toEqual([]);

    const { error: invalidEnvelopeSave } = await userA.client.rpc(
      "save_routine_document",
      {
        routine_id: routineA,
        expected_revision: 2,
        document: [],
      },
    );
    expect(invalidEnvelopeSave).not.toBeNull();

    const { error: validReorder } = await userA.client.rpc("reorder_routines", {
      ordered_ids: [routineASecond, routineA],
    });
    expect(validReorder).toBeNull();

    const { data: reordered, error: reorderedReadError } = await userA.client
      .from("routines")
      .select("id, position")
      .order("position");
    expect(reorderedReadError).toBeNull();
    expect(reordered).toEqual([
      { id: routineASecond, position: 0 },
      { id: routineA, position: 1 },
    ]);

    const { error: incompleteReorder } = await userA.client.rpc(
      "reorder_routines",
      { ordered_ids: [routineA] },
    );
    expect(incompleteReorder).not.toBeNull();

    const { error: duplicateReorder } = await userA.client.rpc(
      "reorder_routines",
      { ordered_ids: [routineA, routineA] },
    );
    expect(duplicateReorder).not.toBeNull();

    const { error: foreignReorder } = await userB.client.rpc(
      "reorder_routines",
      { ordered_ids: [routineA] },
    );
    expect(foreignReorder).not.toBeNull();

    const { data: afterRejectedReorders, error: rejectedReorderReadError } =
      await userA.client
        .from("routines")
        .select("id, position")
        .order("position");
    expect(rejectedReorderReadError).toBeNull();
    expect(afterRejectedReorders).toEqual(reordered);

    const completionA = {
      routine_id: routineA,
      scope_activity_block_id: "activity-a",
      block_id: "check-a",
      block_type: "checklist" as const,
      completion_date: "2026-09-13",
    };
    const { data: insertedCompletionA, error: completionAInsertError } =
      await userA.client
        .from("block_completions")
        .insert(completionA)
        .select("id, completed_at")
        .single();
    expect(completionAInsertError).toBeNull();
    expect(insertedCompletionA).not.toBeNull();

    const { error: spoofCompletionAudit } = await userA.client
      .from("block_completions")
      .insert({
        ...completionA,
        block_id: "spoof-audit",
        completed_at: "2000-01-01T00:00:00Z",
      });
    expect(spoofCompletionAudit).not.toBeNull();

    const { error: overwriteCompletionAudit } = await userA.client
      .from("block_completions")
      .update({ completed_at: "2000-01-01T00:00:00Z" })
      .eq("id", insertedCompletionA?.id ?? "");
    expect(overwriteCompletionAudit).not.toBeNull();

    const { error: duplicateCompletionError } = await userA.client
      .from("block_completions")
      .upsert(completionA, {
        onConflict:
          "routine_id,scope_activity_block_id,block_id,completion_date",
        ignoreDuplicates: true,
      });
    expect(duplicateCompletionError).toBeNull();

    const { data: completionAfterRetry, error: retryReadError } =
      await userA.client
        .from("block_completions")
        .select("id, completed_at")
        .eq("id", insertedCompletionA?.id ?? "")
        .single();
    expect(retryReadError).toBeNull();
    expect(completionAfterRetry).toEqual(insertedCompletionA);

    const { data: completionsSeenByB, error: completionBSelectError } =
      await userB.client
        .from("block_completions")
        .select("id")
        .eq("routine_id", routineA);
    expect(completionBSelectError).toBeNull();
    expect(completionsSeenByB).toEqual([]);

    const { error: foreignCompletionInsert } = await userB.client
      .from("block_completions")
      .insert({ ...completionA, block_id: "foreign-check" });
    expect(foreignCompletionInsert).not.toBeNull();

    const { data: foreignCompletionUpdate, error: completionUpdateError } =
      await userB.client
        .from("block_completions")
        .update({ block_id: "leaked-check" })
        .eq("id", insertedCompletionA?.id ?? "")
        .select("id");
    expect(completionUpdateError).toBeNull();
    expect(foreignCompletionUpdate).toEqual([]);

    const { error: moveCompletionToForeignRoutine } = await userA.client
      .from("block_completions")
      .update({ routine_id: routineB })
      .eq("id", insertedCompletionA?.id ?? "");
    expect(moveCompletionToForeignRoutine).not.toBeNull();

    const { data: foreignCompletionDelete, error: completionDeleteError } =
      await userB.client
        .from("block_completions")
        .delete()
        .eq("id", insertedCompletionA?.id ?? "")
        .select("id");
    expect(completionDeleteError).toBeNull();
    expect(foreignCompletionDelete).toEqual([]);

    const completionB = {
      routine_id: routineB,
      scope_activity_block_id: "activity-b",
      block_id: "activity-b",
      block_type: "activity" as const,
      completion_date: "2026-09-13",
    };
    const { data: insertedCompletionB, error: completionBInsertError } =
      await userB.client
        .from("block_completions")
        .insert(completionB)
        .select("id")
        .single();
    expect(completionBInsertError).toBeNull();

    const { error: completionBOwnUpdate } = await userB.client
      .from("block_completions")
      .update({ completion_date: "2026-09-14" })
      .eq("id", insertedCompletionB?.id ?? "");
    expect(completionBOwnUpdate).toBeNull();

    const { error: completionBOwnDelete } = await userB.client
      .from("block_completions")
      .delete()
      .eq("id", insertedCompletionB?.id ?? "");
    expect(completionBOwnDelete).toBeNull();

    const { error: invalidActivityScope } = await userA.client
      .from("block_completions")
      .insert({
        ...completionA,
        block_id: "another-activity",
        block_type: "activity",
      });
    expect(invalidActivityScope).not.toBeNull();

    const anonRoutineOperations = await Promise.all([
      anon.from("routines").select("id"),
      anon.from("routines").insert({
        user_id: userA.userId,
        name: "Anon",
        recurrence_type: "daily",
        specific_date: null,
        position: 0,
      }),
      anon.from("routines").update({ name: "Anon" }).eq("id", routineA),
      anon.from("routines").delete().eq("id", routineA),
    ]);
    expect(anonRoutineOperations.every(({ error }) => error !== null)).toBe(
      true,
    );

    const anonCompletionOperations = await Promise.all([
      anon.from("block_completions").select("id"),
      anon.from("block_completions").insert(completionA),
      anon
        .from("block_completions")
        .update({ block_id: "anon" })
        .eq("id", insertedCompletionA?.id ?? ""),
      anon
        .from("block_completions")
        .delete()
        .eq("id", insertedCompletionA?.id ?? ""),
    ]);
    expect(anonCompletionOperations.every(({ error }) => error !== null)).toBe(
      true,
    );

    const { error: anonReorder } = await anon.rpc("reorder_routines", {
      ordered_ids: [routineA, routineASecond],
    });
    expect(anonReorder).not.toBeNull();

    const { error: anonSave } = await anon.rpc("save_routine_document", {
      routine_id: routineA,
      expected_revision: 2,
      document: { schemaVersion: 1, blocks: [] },
    });
    expect(anonSave).not.toBeNull();

    const { error: completionAOwnUpdate } = await userA.client
      .from("block_completions")
      .update({ block_id: "check-a-renamed" })
      .eq("id", insertedCompletionA?.id ?? "");
    expect(completionAOwnUpdate).toBeNull();

    const { error: routineBUpdate } = await userB.client
      .from("routines")
      .update({ name: "B renamed" })
      .eq("id", routineB);
    expect(routineBUpdate).toBeNull();

    const { error: routineBDelete } = await userB.client
      .from("routines")
      .delete()
      .eq("id", routineB);
    expect(routineBDelete).toBeNull();

    const parallelCreates = await Promise.all(
      ["Concurrent one", "Concurrent two", "Concurrent three"].map(
        (routineName) =>
          userA.client.rpc("create_routine", {
            routine_name: routineName,
            routine_icon: null,
            routine_recurrence_type: "daily",
            routine_specific_date: null,
          }),
      ),
    );
    expect(parallelCreates.every(({ error }) => error === null)).toBe(true);
    expect(new Set(parallelCreates.map(({ data }) => data)).size).toBe(3);

    const { data: finalOrder, error: finalOrderError } = await userA.client
      .from("routines")
      .select("position")
      .order("position");
    expect(finalOrderError).toBeNull();
    expect(finalOrder?.map(({ position }) => position)).toEqual([
      0, 1, 2, 3, 4,
    ]);

    const createdIds = parallelCreates
      .map(({ data }) => data)
      .filter((id): id is string => typeof id === "string");
    const { data: createdDefaults, error: createdDefaultsError } =
      await userA.client
        .from("routines")
        .select("content, revision")
        .in("id", createdIds);
    expect(createdDefaultsError).toBeNull();
    expect(createdDefaults).toHaveLength(3);
    for (const created of createdDefaults ?? []) {
      expect(created).toEqual({
        content: { schemaVersion: 1, blocks: [] },
        revision: 0,
      });
    }

    const draftCopyRequestId = crypto.randomUUID();
    const draftCopyDocument = {
      schemaVersion: 1 as const,
      blocks: [
        {
          id: "draft-copy-activity",
          type: "activity",
          props: { custom: "preserve-exactly" },
          children: [{ id: "draft-copy-check", type: "checkListItem" }],
        },
      ],
    };
    const copyCalls = await Promise.all(
      Array.from({ length: 3 }, () =>
        userA.client.rpc("create_routine_from_draft", {
          source_routine_id: routineA,
          document: draftCopyDocument,
          routine_name: "Recovered draft copy",
          routine_icon: "moon",
          routine_recurrence_type: "daily",
          routine_specific_date: null,
          request_id: draftCopyRequestId,
        })
      ),
    );
    expect(copyCalls.every(({ error }) => error === null)).toBe(true);
    const copiedRoutineId = copyCalls[0]?.data;
    expect(copiedRoutineId).toEqual(expect.any(String));
    expect(copyCalls.every(({ data }) => data === copiedRoutineId)).toBe(true);

    const { data: copiedRoutines, error: copiedRoutineError } =
      await userA.client
        .from("routines")
        .select("id, name, icon, content, revision, position")
        .eq("name", "Recovered draft copy");
    expect(copiedRoutineError).toBeNull();
    expect(copiedRoutines).toEqual([
      {
        id: copiedRoutineId,
        name: "Recovered draft copy",
        icon: "moon",
        content: draftCopyDocument,
        revision: 0,
        position: 5,
      },
    ]);

    const { data: replayedCopy, error: replayedCopyError } =
      await userA.client.rpc("create_routine_from_draft", {
        source_routine_id: routineA,
        document: { schemaVersion: 1, blocks: [{ id: "must-not-replace" }] },
        routine_name: "Must not create another routine",
        routine_icon: null,
        routine_recurrence_type: "specific_date",
        routine_specific_date: "2026-09-19",
        request_id: draftCopyRequestId,
      });
    expect(replayedCopyError).toBeNull();
    expect(replayedCopy).toBe(copiedRoutineId);

    const routineBCopySource = await insertRoutine(
      userB.client,
      userB.userId,
      "B copy source",
      0,
    );
    const { data: userBCopy, error: userBCopyError } = await userB.client.rpc(
      "create_routine_from_draft",
      {
        source_routine_id: routineBCopySource,
        document: draftCopyDocument,
        routine_name: "B recovered copy",
        routine_icon: null,
        routine_recurrence_type: "daily",
        routine_specific_date: null,
        request_id: draftCopyRequestId,
      },
    );
    expect(userBCopyError).toBeNull();
    expect(userBCopy).toEqual(expect.any(String));
    expect(userBCopy).not.toBe(copiedRoutineId);

    const inaccessibleRequestId = crypto.randomUUID();
    const { data: foreignDraftCopy, error: foreignDraftCopyError } =
      await userB.client.rpc("create_routine_from_draft", {
        source_routine_id: routineA,
        document: draftCopyDocument,
        routine_name: "Foreign copy",
        routine_icon: null,
        routine_recurrence_type: "daily",
        routine_specific_date: null,
        request_id: inaccessibleRequestId,
      });
    const { data: missingDraftCopy, error: missingDraftCopyError } =
      await userB.client.rpc("create_routine_from_draft", {
        source_routine_id: crypto.randomUUID(),
        document: draftCopyDocument,
        routine_name: "Missing copy",
        routine_icon: null,
        routine_recurrence_type: "daily",
        routine_specific_date: null,
        request_id: crypto.randomUUID(),
      });
    expect(foreignDraftCopyError).toBeNull();
    expect(missingDraftCopyError).toBeNull();
    expect(foreignDraftCopy).toBeNull();
    expect(missingDraftCopy).toBeNull();

    const { data: directIdempotencyRead, error: directReadError } =
      await userA.client.from("routine_draft_copy_requests").select("*");
    expect(directReadError).toBeNull();
    expect(directIdempotencyRead).toEqual([]);

    const { error: directIdempotencyInsert } = await userA.client
      .from("routine_draft_copy_requests")
      .insert({
        user_id: userA.userId,
        request_id: crypto.randomUUID(),
        routine_id: routineA,
      });
    expect(directIdempotencyInsert).not.toBeNull();

    const { error: anonDraftCopy } = await anon.rpc(
      "create_routine_from_draft",
      {
        source_routine_id: routineA,
        document: draftCopyDocument,
        routine_name: "Anon copy",
        routine_icon: null,
        routine_recurrence_type: "daily",
        routine_specific_date: null,
        request_id: crypto.randomUUID(),
      },
    );
    expect(anonDraftCopy).not.toBeNull();

    const { error: cascadeRoutineDelete } = await userA.client
      .from("routines")
      .delete()
      .eq("id", routineA);
    expect(cascadeRoutineDelete).toBeNull();

    const { data: replayAfterSourceDelete, error: replayAfterDeleteError } =
      await userA.client.rpc("create_routine_from_draft", {
        source_routine_id: routineA,
        document: draftCopyDocument,
        routine_name: "Recovered draft copy",
        routine_icon: "moon",
        routine_recurrence_type: "daily",
        routine_specific_date: null,
        request_id: draftCopyRequestId,
      });
    expect(replayAfterDeleteError).toBeNull();
    expect(replayAfterSourceDelete).toBe(copiedRoutineId);

    const { data: cascadedCompletion, error: cascadeReadError } =
      await userA.client
        .from("block_completions")
        .select("id")
        .eq("id", insertedCompletionA?.id ?? "");
    expect(cascadeReadError).toBeNull();
    expect(cascadedCompletion).toEqual([]);

    const { error: anonCreateRoutine } = await anon.rpc("create_routine", {
      routine_name: "Anon RPC",
      routine_icon: null,
      routine_recurrence_type: "daily",
      routine_specific_date: null,
    });
    expect(anonCreateRoutine).not.toBeNull();
  }, 30_000);
});
