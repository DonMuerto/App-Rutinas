import { describe, expect, it, vi } from "vitest";

import type { CompletionMutationRepository } from "../contracts";
import { CompletionStore, type CompletionTarget } from "./completion-store";

const target: CompletionTarget = {
  routineId: "3947f2ca-d682-42f5-b62f-493a588321ef",
  scopeActivityBlockId: "activity-a",
  blockId: "activity-a",
  blockType: "activity",
};

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe("CompletionStore", () => {
  it("updates optimistically and ignores stale hydration", async () => {
    const mutation = deferred();
    const repository: CompletionMutationRepository = {
      mark: vi.fn(() => mutation.promise),
      unmark: vi.fn(),
    };
    const store = new CompletionStore(repository);
    const revision = store.getRevision("user-a");

    const result = store.toggle("user-a", target, "2026-09-18");

    expect(store.getState("user-a", target, "2026-09-18")).toEqual({
      completed: true,
      pending: true,
    });
    store.hydrate(
      "user-a",
      "2026-09-18",
      [{ target, completed: false }],
      revision,
    );
    expect(store.getState("user-a", target, "2026-09-18").completed).toBe(true);

    mutation.resolve();
    await result;
    expect(store.getState("user-a", target, "2026-09-18")).toEqual({
      completed: true,
      pending: false,
    });
  });

  it("rolls back a failed mutation and announces the error", async () => {
    const repository: CompletionMutationRepository = {
      mark: vi.fn().mockRejectedValue(new Error("offline")),
      unmark: vi.fn(),
    };
    const store = new CompletionStore(repository);

    await store.toggle("user-a", target, "2026-09-18");

    expect(store.getState("user-a", target, "2026-09-18")).toEqual({
      completed: false,
      pending: false,
    });
    expect(store.getAnnouncement("user-a")).toMatch(/Restauramos/);
  });

  it("aborts and clears only the requested user", async () => {
    const mutation = deferred();
    let capturedSignal: AbortSignal | undefined;
    const repository: CompletionMutationRepository = {
      mark: vi.fn((_key, signal) => {
        capturedSignal = signal;
        return mutation.promise;
      }),
      unmark: vi.fn(),
    };
    const store = new CompletionStore(repository);
    store.hydrate("user-b", "2026-09-18", [{ target, completed: true }]);
    const pending = store.toggle("user-a", target, "2026-09-18");

    store.clearUser("user-a");

    expect(capturedSignal?.aborted).toBe(true);
    expect(store.getState("user-a", target, "2026-09-18").completed).toBe(
      false,
    );
    expect(store.getState("user-b", target, "2026-09-18").completed).toBe(true);
    mutation.reject(new Error("aborted"));
    await pending;
  });
});
