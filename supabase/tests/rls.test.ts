// @vitest-environment node

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../../lib/supabase/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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
    "RLS tests require explicit NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY values pointing to loopback.",
  );
}

const describeWithLocalSupabase = runRlsTests ? describe : describe.skip;
const password = "Rls-test-2026";

function anonymousClient() {
  if (!url || !anonKey) {
    throw new Error("Supabase local test environment is not configured.");
  }

  return createClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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
  client: SupabaseClient<Database>,
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
      content: [],
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

    const { error: completionAOwnUpdate } = await userA.client
      .from("block_completions")
      .update({ block_id: "check-a-renamed" })
      .eq("id", insertedCompletionA?.id ?? "");
    expect(completionAOwnUpdate).toBeNull();

    const { error: completionAOwnDelete } = await userA.client
      .from("block_completions")
      .delete()
      .eq("id", insertedCompletionA?.id ?? "");
    expect(completionAOwnDelete).toBeNull();

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

    const { error: anonCreateRoutine } = await anon.rpc("create_routine", {
      routine_name: "Anon RPC",
      routine_icon: null,
      routine_recurrence_type: "daily",
      routine_specific_date: null,
    });
    expect(anonCreateRoutine).not.toBeNull();
  }, 30_000);
});
