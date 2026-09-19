import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { createWebPlatformServices, validateExternalUrl } from "./index";

describe("web platform", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("namespaces session storage", async () => {
    const platform = createWebPlatformServices();
    await platform.secureStorage.set("session", "token");

    expect(localStorage.getItem("ritmo:v1:session")).toBe("token");
    expect(await platform.secureStorage.get("session")).toBe("token");
    await platform.dispose();
  });

  it("stores drafts atomically by user and routine", async () => {
    const platform = createWebPlatformServices();
    await platform.drafts.compareExchange({
      userId: "user-a",
      routineId: "routine-a",
      expectedStorageVersion: null,
      next: {
        version: 1,
        userId: "user-a",
        routineId: "routine-a",
        baseRevision: 1,
        generation: 2,
        documentEnvelope: { schemaVersion: 1, blocks: [] },
        localDate: "2026-09-18",
        updatedAt: 10,
      },
    });

    expect(await platform.drafts.get("user-a", "routine-a")).toMatchObject({
      journal: { generation: 2 },
    });
    await platform.dispose();
  });

  it("rejects stale IndexedDB compare-and-exchange writes", async () => {
    const platform = createWebPlatformServices();
    const draft = {
      version: 1 as const,
      userId: "user-a",
      routineId: "routine-cas",
      baseRevision: 1,
      generation: 1,
      documentEnvelope: { schemaVersion: 1 as const, blocks: [] },
      localDate: "2026-09-18",
      updatedAt: 10,
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
      next: { ...draft, generation: 2 },
    });
    expect(stale).toMatchObject({
      applied: false,
      current: { journal: { generation: 1 } },
    });
    await platform.dispose();
  });

  it("only allows http and https external links", () => {
    expect(validateExternalUrl("https://ritmo.example/").protocol).toBe(
      "https:",
    );
    expect(() => validateExternalUrl("file:///etc/passwd")).toThrow(
      "Unsupported external URL scheme.",
    );
  });
});
