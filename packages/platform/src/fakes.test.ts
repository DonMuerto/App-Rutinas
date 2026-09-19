import { describe, expect, it, vi } from "vitest";

import { createFakePlatformServices } from "./fakes";

describe("fake platform services", () => {
  it("provides deterministic storage isolated by user", async () => {
    const platform = createFakePlatformServices();
    await platform.drafts.compareExchange({
      userId: "user-a",
      routineId: "routine-a",
      expectedStorageVersion: null,
      next: {
        version: 1,
        userId: "user-a",
        routineId: "routine-a",
        baseRevision: 2,
        generation: 3,
        documentEnvelope: { schemaVersion: 1, blocks: [] },
        localDate: "2026-09-18",
        updatedAt: 100,
      },
    });

    expect(await platform.drafts.list("user-a")).toHaveLength(1);
    expect(await platform.drafts.list("user-b")).toHaveLength(0);
    await platform.drafts.clearUser("user-a");
    expect(await platform.drafts.list("user-a")).toHaveLength(0);
  });

  it("does not overwrite a draft when its storage version is stale", async () => {
    const platform = createFakePlatformServices();
    const draft = {
      version: 1 as const,
      userId: "user-a",
      routineId: "routine-a",
      baseRevision: 2,
      generation: 3,
      documentEnvelope: { schemaVersion: 1 as const, blocks: [] },
      localDate: "2026-09-18",
      updatedAt: 100,
    };
    const first = await platform.drafts.compareExchange({
      userId: draft.userId,
      routineId: draft.routineId,
      expectedStorageVersion: null,
      next: draft,
    });
    expect(first.applied).toBe(true);

    const stale = await platform.drafts.compareExchange({
      userId: draft.userId,
      routineId: draft.routineId,
      expectedStorageVersion: null,
      next: { ...draft, generation: 4 },
    });
    expect(stale).toMatchObject({
      applied: false,
      current: { journal: { generation: 3 } },
    });
    expect(
      await platform.drafts.get(draft.userId, draft.routineId),
    ).toMatchObject({ journal: { generation: 3 } });
  });

  it("subscribes and unsubscribes lifecycle listeners", async () => {
    const platform = createFakePlatformServices();
    const listener = vi.fn();
    const unsubscribe = platform.lifecycle.subscribe(listener);

    await platform.emitLifecycle("resume");
    unsubscribe();
    await platform.emitLifecycle("background");

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith("resume");
  });

  it("stops lifecycle arbitration at the highest-priority handler", async () => {
    const platform = createFakePlatformServices();
    const shell = vi.fn(() => "handled" as const);
    const editor = vi.fn(() => "handled" as const);
    platform.lifecycle.subscribe(shell);
    platform.lifecycle.subscribe(editor, { priority: 10 });

    await platform.emitLifecycle("back-requested");

    expect(editor).toHaveBeenCalledOnce();
    expect(shell).not.toHaveBeenCalled();
  });

  it("rejects non-http external links", async () => {
    const platform = createFakePlatformServices();
    await expect(
      platform.externalLinks.open("javascript:alert(1)"),
    ).rejects.toThrow("Unsupported external URL scheme.");
  });
});
