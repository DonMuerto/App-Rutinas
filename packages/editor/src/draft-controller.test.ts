import type { RoutineDocument } from "@ritmo/core";
import type {
  DraftCompareExchangeResult,
  DraftJournal,
  DraftStoragePort,
  StoredDraft,
} from "@ritmo/platform";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDraftExitAdapter,
  DraftController,
  type DocumentPersistencePort,
  type SaveDocumentResult,
} from "./draft-controller";

const userId = "user-a";
const routineId = "6dc5a254-20d1-4a58-bb25-f872847aad1b";

function documentWith(text: string): RoutineDocument {
  return {
    schemaVersion: 1,
    blocks: [
      {
        id: "paragraph-a",
        type: "paragraph",
        props: {},
        content: text,
        children: [],
      },
    ],
  };
}

class MemoryDraftStorage implements DraftStoragePort {
  readonly values = new Map<string, StoredDraft>();
  readonly writes: DraftJournal[] = [];
  failNext = false;
  afterDeleteApplied?: () => Promise<void>;
  private version = 0;

  async get(requestUserId: string, requestRoutineId: string) {
    return this.values.get(`${requestUserId}:${requestRoutineId}`) ?? null;
  }

  async list(requestUserId: string) {
    return [...this.values.values()].filter(
      ({ journal }) => journal.userId === requestUserId,
    );
  }

  async compareExchange(input: {
    userId: string;
    routineId: string;
    expectedStorageVersion: string | null;
    next: DraftJournal | null;
  }): Promise<DraftCompareExchangeResult> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("disk full");
    }
    const key = `${input.userId}:${input.routineId}`;
    const current = this.values.get(key) ?? null;
    if ((current?.storageVersion ?? null) !== input.expectedStorageVersion) {
      return { applied: false, current };
    }
    if (!input.next) {
      this.values.delete(key);
      await this.afterDeleteApplied?.();
      return { applied: true, current: null };
    }
    const stored = {
      storageVersion: `v${++this.version}`,
      journal: input.next,
    };
    this.writes.push(input.next);
    this.values.set(key, stored);
    return { applied: true, current: stored };
  }

  async clearUser(requestUserId: string) {
    for (const [key, { journal }] of this.values) {
      if (journal.userId === requestUserId) this.values.delete(key);
    }
  }
}

function remotePort(
  saveDocument: DocumentPersistencePort["saveDocument"] = async () => ({
    kind: "saved",
    revision: 1,
  }),
): DocumentPersistencePort {
  return {
    saveDocument,
    async loadDocument(requestRoutineId) {
      return {
        routineId: requestRoutineId,
        document: documentWith("remote"),
        revision: 2,
      };
    },
    async createFromDraft(input) {
      return {
        routineId: "17a9ae95-028a-4d67-bad8-e1949210f0ee",
        document: input.document,
        revision: 0,
      };
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

afterEach(() => vi.useRealTimers());

describe("DraftController", () => {
  it("protects the draft locally before the debounced remote save", async () => {
    vi.useFakeTimers();
    const storage = new MemoryDraftStorage();
    const saveDocument = vi.fn(remotePort().saveDocument);
    const controller = new DraftController({
      userId,
      storage,
      remote: remotePort(saveDocument),
      now: () => 100,
    });
    await controller.initialize();

    await controller.recordChange({
      routineId,
      document: documentWith("local"),
      baseRevision: 0,
      localDate: "2026-09-18",
    });

    expect(storage.writes).toHaveLength(1);
    expect(saveDocument).not.toHaveBeenCalled();
    expect(controller.getSnapshot().drafts[0]).toMatchObject({
      generation: 1,
      locallyProtected: true,
      phase: "pending",
    });

    await vi.advanceTimersByTimeAsync(750);
    expect(saveDocument).toHaveBeenCalledOnce();
    expect(await storage.get(userId, routineId)).toBeNull();
  });

  it("keeps and rebases a newer generation when an old save succeeds", async () => {
    const storage = new MemoryDraftStorage();
    const firstSave = deferred<SaveDocumentResult>();
    const saveDocument = vi
      .fn<DocumentPersistencePort["saveDocument"]>()
      .mockImplementationOnce(() => firstSave.promise)
      .mockResolvedValueOnce({ kind: "saved", revision: 2 });
    const controller = new DraftController({
      userId,
      storage,
      remote: remotePort(saveDocument),
    });
    await controller.initialize();
    await controller.recordChange({
      routineId,
      document: documentWith("first"),
      baseRevision: 0,
      localDate: "2026-09-18",
    });

    const flushing = controller.flushRoutine(routineId);
    await vi.waitFor(() => expect(saveDocument).toHaveBeenCalledOnce());
    await controller.recordChange({
      routineId,
      document: documentWith("newer"),
      baseRevision: 0,
      localDate: "2026-09-18",
    });
    firstSave.resolve({ kind: "saved", revision: 1 });
    await flushing;

    expect(saveDocument).toHaveBeenCalledTimes(2);
    expect(saveDocument.mock.calls[1]?.[0]).toMatchObject({
      expectedRevision: 1,
      document: documentWith("newer"),
    });
    expect(await storage.get(userId, routineId)).toBeNull();
  });

  it("does not delete an edit made while saved-draft cleanup is pending", async () => {
    const storage = new MemoryDraftStorage();
    const deletionStarted = deferred<void>();
    const releaseDeletion = deferred<void>();
    storage.afterDeleteApplied = async () => {
      deletionStarted.resolve();
      await releaseDeletion.promise;
      storage.afterDeleteApplied = undefined;
    };
    const controller = new DraftController({
      userId,
      storage,
      remote: remotePort(),
      debounceMs: 60_000,
    });
    await controller.initialize();
    await controller.recordChange({
      routineId,
      document: documentWith("first"),
      baseRevision: 0,
      localDate: "2026-09-18",
    });

    const flushing = controller.flushRoutine(routineId);
    await deletionStarted.promise;
    const recording = controller.recordChange({
      routineId,
      document: documentWith("newer"),
      baseRevision: 0,
      localDate: "2026-09-18",
    });
    releaseDeletion.resolve();
    await recording;
    await flushing;

    expect(await storage.get(userId, routineId)).toMatchObject({
      journal: {
        generation: 2,
        baseRevision: 1,
        documentEnvelope: documentWith("newer"),
      },
    });
    expect(controller.getSnapshot().drafts[0]).toMatchObject({
      generation: 2,
      locallyProtected: true,
    });
  });

  it("restores a protected draft after a full controller reload", async () => {
    const storage = new MemoryDraftStorage();
    const first = new DraftController({
      userId,
      storage,
      remote: remotePort(),
      debounceMs: 60_000,
    });
    await first.initialize();
    await first.recordChange({
      routineId,
      document: documentWith("offline reload"),
      baseRevision: 2,
      localDate: "2026-09-18",
    });
    await first.dispose();

    const reloaded = new DraftController({
      userId,
      storage,
      remote: remotePort(),
    });
    await reloaded.initialize();
    expect(
      await reloaded.restore({
        routineId,
        document: documentWith("remote"),
        revision: 2,
      }),
    ).toMatchObject({
      kind: "restored-draft",
      document: { document: documentWith("offline reload"), revision: 2 },
    });
  });

  it("resumes autosave after restoring a draft with the current revision", async () => {
    vi.useFakeTimers();
    const storage = new MemoryDraftStorage();
    const first = new DraftController({
      userId,
      storage,
      remote: remotePort(),
      debounceMs: 60_000,
    });
    await first.initialize();
    await first.recordChange({
      routineId,
      document: documentWith("restore and save"),
      baseRevision: 2,
      localDate: "2026-09-18",
    });
    await first.dispose();

    const saveDocument = vi.fn<DocumentPersistencePort["saveDocument"]>(
      async () => ({ kind: "saved", revision: 3 }),
    );
    const reloaded = new DraftController({
      userId,
      storage,
      remote: remotePort(saveDocument),
    });
    await reloaded.initialize();
    await reloaded.restore({
      routineId,
      document: documentWith("remote"),
      revision: 2,
    });

    await vi.advanceTimersByTimeAsync(750);

    expect(saveDocument).toHaveBeenCalledWith({
      routineId,
      document: documentWith("restore and save"),
      expectedRevision: 2,
    });
    await vi.waitFor(async () => {
      expect(await storage.get(userId, routineId)).toBeNull();
    });
  });

  it("retries a real network failure without losing the local journal", async () => {
    const storage = new MemoryDraftStorage();
    const saveDocument = vi
      .fn<DocumentPersistencePort["saveDocument"]>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ kind: "saved", revision: 1 });
    const controller = new DraftController({
      userId,
      storage,
      remote: remotePort(saveDocument),
    });
    await controller.initialize();
    await controller.recordChange({
      routineId,
      document: documentWith("retry me"),
      baseRevision: 0,
      localDate: "2026-09-18",
    });

    expect(await controller.flushRoutine(routineId)).toMatchObject({
      kind: "failed",
      failure: { kind: "network", retryable: true },
    });
    expect(await storage.get(userId, routineId)).not.toBeNull();
    expect(await controller.flushRoutine(routineId)).toEqual({
      kind: "synced",
      routineId,
      revision: 1,
    });
    expect(await storage.get(userId, routineId)).toBeNull();
  });

  it("allows only one remote document operation at a time", async () => {
    const storage = new MemoryDraftStorage();
    const firstSave = deferred<SaveDocumentResult>();
    const saveDocument = vi
      .fn<DocumentPersistencePort["saveDocument"]>()
      .mockImplementationOnce(() => firstSave.promise)
      .mockResolvedValueOnce({ kind: "saved", revision: 1 });
    const controller = new DraftController({
      userId,
      storage,
      remote: remotePort(saveDocument),
    });
    await controller.initialize();
    await controller.recordChange({
      routineId,
      document: documentWith("first"),
      baseRevision: 0,
      localDate: "2026-09-18",
    });
    await controller.recordChange({
      routineId: "e2a9625d-19f0-4b5f-a855-b91847f3dc22",
      document: documentWith("second"),
      baseRevision: 0,
      localDate: "2026-09-18",
    });

    const flushing = controller.flushAll();
    await vi.waitFor(() => expect(saveDocument).toHaveBeenCalledOnce());
    firstSave.resolve({ kind: "saved", revision: 1 });
    await flushing;
    expect(saveDocument).toHaveBeenCalledTimes(2);
  });

  it("retains conflicts and can save the exact draft as a new routine", async () => {
    const storage = new MemoryDraftStorage();
    const controller = new DraftController({
      userId,
      storage,
      remote: remotePort(async () => ({
        kind: "conflict",
        actualRevision: 4,
      })),
    });
    await controller.initialize();
    const draft = await controller.recordChange({
      routineId,
      document: documentWith("conflict"),
      baseRevision: 2,
      localDate: "2026-09-18",
    });

    expect(await controller.flushRoutine(routineId)).toEqual({
      kind: "conflict",
      draft,
      actualRevision: 4,
    });
    expect(await storage.get(userId, routineId)).not.toBeNull();

    const copied = await controller.saveConflictAsNew({
      draft,
      metadata: {
        name: "Copia recuperada",
        icon: null,
        recurrenceType: "daily",
        specificDate: null,
      },
    });
    expect(copied.kind).toBe("created");
    expect(await storage.get(userId, routineId)).toBeNull();
  });

  it("requires an exact generation for confirmed discard", async () => {
    const storage = new MemoryDraftStorage();
    const controller = new DraftController({
      userId,
      storage,
      remote: remotePort(),
    });
    await controller.initialize();
    const draft = await controller.recordChange({
      routineId,
      document: documentWith("draft"),
      baseRevision: 0,
      localDate: "2026-09-18",
    });

    expect(
      await controller.discard({
        ...draft,
        generation: draft.generation - 1,
        confirmed: true,
      }),
    ).toBe("superseded");
    expect(await controller.discard({ ...draft, confirmed: true })).toBe(
      "discarded",
    );
  });

  it("blocks remote save and exit after local storage failure", async () => {
    const storage = new MemoryDraftStorage();
    storage.failNext = true;
    const saveDocument = vi.fn(remotePort().saveDocument);
    const controller = new DraftController({
      userId,
      storage,
      remote: remotePort(saveDocument),
    });
    await controller.initialize();

    await expect(
      controller.recordChange({
        routineId,
        document: documentWith("unprotected"),
        baseRevision: 0,
        localDate: "2026-09-18",
      }),
    ).rejects.toThrow("disk full");
    expect(await controller.flushRoutine(routineId)).toMatchObject({
      kind: "failed",
      failure: { kind: "storage" },
    });
    expect(saveDocument).not.toHaveBeenCalled();
    expect(controller.getSnapshot().blocksExit).toBe(true);
  });

  it("recovers the local write queue after a transient storage failure", async () => {
    const storage = new MemoryDraftStorage();
    storage.failNext = true;
    const controller = new DraftController({
      userId,
      storage,
      remote: remotePort(),
      debounceMs: 60_000,
    });
    await controller.initialize();

    await expect(
      controller.recordChange({
        routineId,
        document: documentWith("failed"),
        baseRevision: 0,
        localDate: "2026-09-18",
      }),
    ).rejects.toThrow("disk full");
    await expect(
      controller.recordChange({
        routineId,
        document: documentWith("recovered"),
        baseRevision: 0,
        localDate: "2026-09-18",
      }),
    ).resolves.toEqual({ routineId, generation: 2 });

    expect(await storage.get(userId, routineId)).toMatchObject({
      journal: {
        generation: 2,
        documentEnvelope: documentWith("recovered"),
      },
    });
  });

  it("adapts pending drafts to the session exit contract", async () => {
    const storage = new MemoryDraftStorage();
    const createFromDraft = vi.fn(remotePort().createFromDraft);
    const controller = new DraftController({
      userId,
      storage,
      remote: { ...remotePort(), createFromDraft },
    });
    await controller.initialize();
    await controller.recordChange({
      routineId,
      document: documentWith("copy before logout"),
      baseRevision: 0,
      localDate: "2026-09-18",
    });
    const adapter = createDraftExitAdapter({
      userId,
      controller,
      resolveCopyMetadata: () => ({
        name: "Copia recuperada",
        icon: null,
        recurrenceType: "daily",
        specificDate: null,
      }),
    });

    expect(await adapter.inspectForExit(userId)).toEqual({
      pendingCount: 1,
      canSync: true,
    });
    await adapter.saveCopyAndDiscard(userId);
    expect(createFromDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceRoutineId: routineId,
        document: documentWith("copy before logout"),
        requestId: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        ),
      }),
    );
    expect(await adapter.inspectForExit(userId)).toEqual({
      pendingCount: 0,
      canSync: true,
    });
  });
});
