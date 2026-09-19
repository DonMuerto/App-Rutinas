import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import {
  clearUserQueryData,
  completionKeys,
  repositoryInvalidations,
  routineKeys,
  subscribeToUserQueryCleanup,
} from "./query-keys";
import type { AuthListener } from "./auth-service";

describe("user-segmented query cache", () => {
  it("does not share keys across users", () => {
    expect(routineKeys.metadata("user-a")).not.toEqual(
      routineKeys.metadata("user-b"),
    );
    expect(completionKeys.forDate("user-a", "2026-09-18", ["b", "a"])).toEqual([
      "user",
      "user-a",
      "completions",
      "2026-09-18",
      ["a", "b"],
    ]);
  });

  it("clears one user without leaking into another cache segment", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(routineKeys.metadata("user-a"), ["a"]);
    queryClient.setQueryData(routineKeys.metadata("user-b"), ["b"]);

    clearUserQueryData(queryClient, "user-a");

    expect(
      queryClient.getQueryData(routineKeys.metadata("user-a")),
    ).toBeUndefined();
    expect(queryClient.getQueryData(routineKeys.metadata("user-b"))).toEqual([
      "b",
    ]);
  });

  it("automatically clears the previous user on logout or user change", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(routineKeys.metadata("user-a"), ["a"]);
    queryClient.setQueryData(routineKeys.metadata("user-b"), ["b"]);
    let listener: AuthListener | undefined;
    const unsubscribe = vi.fn();
    const clearAdditionalUserData = vi.fn();
    const stop = subscribeToUserQueryCleanup(
      {
        subscribe(next) {
          listener = next;
          return unsubscribe;
        },
      },
      queryClient,
      clearAdditionalUserData,
    );

    listener?.(
      { status: "authenticated", user: { id: "user-b" } },
      { status: "authenticated", user: { id: "user-a" } },
    );

    expect(
      queryClient.getQueryData(routineKeys.metadata("user-a")),
    ).toBeUndefined();
    expect(queryClient.getQueryData(routineKeys.metadata("user-b"))).toEqual([
      "b",
    ]);
    expect(clearAdditionalUserData).toHaveBeenCalledWith("user-a");
    stop();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("invalidates every completion set for one user and local date", async () => {
    const queryClient = new QueryClient();
    const first = completionKeys.forDate("user-a", "2026-09-18", ["routine-a"]);
    const second = completionKeys.forDate("user-a", "2026-09-18", [
      "routine-b",
    ]);
    const otherUser = completionKeys.forDate("user-b", "2026-09-18", [
      "routine-a",
    ]);
    queryClient.setQueryData(first, []);
    queryClient.setQueryData(second, []);
    queryClient.setQueryData(otherUser, []);

    await repositoryInvalidations.completionChanged(
      queryClient,
      "user-a",
      "2026-09-18",
    );

    expect(queryClient.getQueryState(first)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(second)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(otherUser)?.isInvalidated).toBe(false);
  });
});
