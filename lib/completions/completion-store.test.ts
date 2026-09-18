import { describe, expect, it, vi } from "vitest";

import type { CompletionKey } from "@/lib/contracts";

import { CompletionStore } from "./completion-store";
import type { CompletionTarget } from "./types";

const target: CompletionTarget = {
  routineId: "6dc5a254-20d1-4a58-bb25-f872847aad1b",
  scopeActivityBlockId: "activity-a",
  blockId: "activity-a",
  blockType: "activity",
};

describe("CompletionStore", () => {
  it("applies a mark optimistically and ignores a repeated toggle while pending", async () => {
    let resolveMark: (() => void) | undefined;
    const mark = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveMark = resolve;
        }),
    );
    const store = new CompletionStore({
      mark,
      unmark: vi.fn<(key: CompletionKey) => Promise<void>>(),
    });

    const mutation = store.toggle(target, "2026-09-13");
    const repeatedMutation = store.toggle(target, "2026-09-13");

    expect(store.getState(target, "2026-09-13")).toEqual({
      completed: true,
      pending: true,
    });
    expect(mark).toHaveBeenCalledTimes(1);
    await expect(repeatedMutation).resolves.toBe(true);

    resolveMark?.();
    await expect(mutation).resolves.toBe(true);
    expect(store.getState(target, "2026-09-13")).toEqual({
      completed: true,
      pending: false,
    });
  });

  it("rolls back a failed mutation and publishes a safe announcement", async () => {
    const store = new CompletionStore({
      mark: vi.fn().mockRejectedValue(new Error("sensitive SQL detail")),
      unmark: vi.fn(),
    });

    await expect(store.toggle(target, "2026-09-13")).resolves.toBe(false);

    expect(store.getState(target, "2026-09-13")).toEqual({
      completed: false,
      pending: false,
    });
    expect(store.getAnnouncement()).toBe(
      "No pudimos guardar el cambio. Restauramos el estado anterior.",
    );
    expect(store.getAnnouncement()).not.toContain("SQL");
  });

  it("keeps completion state isolated by local date", async () => {
    const store = new CompletionStore({
      mark: vi.fn().mockResolvedValue(undefined),
      unmark: vi.fn().mockResolvedValue(undefined),
    });

    await store.toggle(target, "2026-09-13");

    expect(store.getState(target, "2026-09-13").completed).toBe(true);
    expect(store.getState(target, "2026-09-14").completed).toBe(false);
  });

  it("converges to incomplete when unmarking", async () => {
    const unmark = vi.fn().mockResolvedValue(undefined);
    const store = new CompletionStore({
      mark: vi.fn().mockResolvedValue(undefined),
      unmark,
    });
    store.hydrate("2026-09-13", [{ target, completed: true }]);

    await store.toggle(target, "2026-09-13");

    expect(unmark).toHaveBeenCalledWith({
      ...target,
      completionDate: "2026-09-13",
    });
    expect(store.getState(target, "2026-09-13").completed).toBe(false);
  });

  it("ignores hydration that started before a completion mutation", async () => {
    const store = new CompletionStore({
      mark: vi.fn().mockResolvedValue(undefined),
      unmark: vi.fn().mockResolvedValue(undefined),
    });
    const hydrationRevision = store.getRevision();

    await store.toggle(target, "2026-09-13");
    store.hydrate(
      "2026-09-13",
      [{ target, completed: false }],
      hydrationRevision,
    );

    expect(store.getState(target, "2026-09-13").completed).toBe(true);
  });
});
