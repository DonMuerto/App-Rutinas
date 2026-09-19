import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { createQueryCachePort } from "./query-cache";

describe("query cache session adapter", () => {
  it("clears canonical repository and feature queries for one user", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["user", "user-a", "routines"], "repository");
    queryClient.setQueryData(["user-a", "today", "2026-09-18"], "feature");
    queryClient.setQueryData(["user", "user-b", "routines"], "other");
    const cache = createQueryCachePort(queryClient);

    await cache.cancelUserQueries("user-a");
    cache.clearUser("user-a");

    expect(queryClient.getQueryData(["user", "user-a", "routines"])).toBe(
      undefined,
    );
    expect(queryClient.getQueryData(["user-a", "today", "2026-09-18"])).toBe(
      undefined,
    );
    expect(queryClient.getQueryData(["user", "user-b", "routines"])).toBe(
      "other",
    );
  });
});
