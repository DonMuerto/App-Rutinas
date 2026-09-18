import type { SupabaseClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { DomainError } from "@/lib/contracts";
import type { Database } from "@/lib/supabase/database.types";

import { createRepositories } from "./create";
import { repositoryError } from "./errors";
import {
  completionKeys,
  repositoryInvalidations,
  routineKeys,
} from "./query-keys";

const ROUTINE_ID = "22222222-2222-4222-8222-222222222222";

function createUpdateClient() {
  const update = vi.fn();
  const maybeSingle = vi.fn(async () => ({
    data: { id: ROUTINE_ID },
    error: null,
  }));
  const query = {
    update: (values: unknown) => {
      update(values);
      return query;
    },
    eq: () => query,
    select: () => query,
    maybeSingle,
  };
  const client = {
    from: vi.fn(() => query),
  } as unknown as SupabaseClient<Database>;

  return { client, update };
}

describe("RoutineRepository partial mutations", () => {
  it("updates only the normalized name when renaming", async () => {
    const { client, update } = createUpdateClient();
    const repository = createRepositories(client).routines;

    await repository.rename(ROUTINE_ID, "  Noche  ");

    expect(update).toHaveBeenCalledWith({ name: "Noche" });
  });

  it("updates only the optional icon", async () => {
    const { client, update } = createUpdateClient();
    const repository = createRepositories(client).routines;

    await repository.updateIcon(ROUTINE_ID, "moon");

    expect(update).toHaveBeenCalledWith({ icon: "moon" });
  });

  it("updates recurrence fields as one valid unit", async () => {
    const { client, update } = createUpdateClient();
    const repository = createRepositories(client).routines;

    await repository.updateRecurrence(ROUTINE_ID, {
      recurrenceType: "specific_date",
      specificDate: "2026-09-13",
    });

    expect(update).toHaveBeenCalledWith({
      recurrence_type: "specific_date",
      specific_date: "2026-09-13",
    });
  });

  it("updates only content when saving a document", async () => {
    const { client, update } = createUpdateClient();
    const repository = createRepositories(client).routines;
    const content = [{ id: "block-1", type: "paragraph" }];

    await repository.saveDocument(ROUTINE_ID, content);

    expect(update).toHaveBeenCalledWith({ content });
  });

  it("updates only the icon", async () => {
    const { client, update } = createUpdateClient();
    const repository = createRepositories(client).routines;

    await repository.updateIcon(ROUTINE_ID, "moon");

    expect(update).toHaveBeenCalledWith({ icon: "moon" });
  });

  it("rejects duplicate reorder IDs before calling Postgres", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as SupabaseClient<Database>;
    const repository = createRepositories(client).routines;

    await expect(
      repository.reorder([ROUTINE_ID, ROUTINE_ID]),
    ).rejects.toMatchObject<Partial<DomainError>>({ code: "VALIDATION" });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("repository query keys", () => {
  it("keeps resources and local dates explicit", () => {
    expect(routineKeys.metadata()).toEqual(["routines", "metadata"]);
    expect(routineKeys.detail(ROUTINE_ID)).toEqual([
      "routines",
      "detail",
      ROUTINE_ID,
    ]);
    expect(routineKeys.today("2026-09-13")).toEqual([
      "routines",
      "today",
      "2026-09-13",
    ]);
  });

  it("canonicalizes routine IDs in completion keys", () => {
    expect(completionKeys.forDate("2026-09-13", ["b", "a"])).toEqual([
      "completions",
      "2026-09-13",
      ["a", "b"],
    ]);
  });

  it("invalidates rename consumers without unrelated completions", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(routineKeys.metadata(), []);
    queryClient.setQueryData(routineKeys.detail(ROUTINE_ID), {});
    queryClient.setQueryData(routineKeys.today("2026-09-13"), []);
    queryClient.setQueryData(
      completionKeys.forDate("2026-09-13", [ROUTINE_ID]),
      [],
    );

    await repositoryInvalidations.routineRenamed(queryClient, ROUTINE_ID);

    expect(
      queryClient.getQueryState(routineKeys.metadata())?.isInvalidated,
    ).toBe(true);
    expect(
      queryClient.getQueryState(routineKeys.detail(ROUTINE_ID))?.isInvalidated,
    ).toBe(true);
    expect(
      queryClient.getQueryState(routineKeys.today("2026-09-13"))?.isInvalidated,
    ).toBe(true);
    expect(
      queryClient.getQueryState(
        completionKeys.forDate("2026-09-13", [ROUTINE_ID]),
      )?.isInvalidated,
    ).toBe(false);
  });

  it("invalidates every completion cache for the changed local date", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      completionKeys.forDate("2026-09-13", [ROUTINE_ID]),
      [],
    );
    queryClient.setQueryData(
      completionKeys.forDate("2026-09-13", ["another-routine"]),
      [],
    );
    queryClient.setQueryData(
      completionKeys.forDate("2026-09-14", [ROUTINE_ID]),
      [],
    );

    await repositoryInvalidations.completionChanged(queryClient, "2026-09-13");

    expect(
      queryClient.getQueryState(
        completionKeys.forDate("2026-09-13", [ROUTINE_ID]),
      )?.isInvalidated,
    ).toBe(true);
    expect(
      queryClient.getQueryState(
        completionKeys.forDate("2026-09-13", ["another-routine"]),
      )?.isInvalidated,
    ).toBe(true);
    expect(
      queryClient.getQueryState(
        completionKeys.forDate("2026-09-14", [ROUTINE_ID]),
      )?.isInvalidated,
    ).toBe(false);
  });
});

describe("repository errors", () => {
  it("classifies expired sessions before generic access failures", () => {
    expect(repositoryError({ status: 401, code: "PGRST301" })).toMatchObject({
      code: "UNAUTHENTICATED",
    });
    expect(repositoryError({ code: "42501" })).toMatchObject({ code: "RLS" });
  });
});
