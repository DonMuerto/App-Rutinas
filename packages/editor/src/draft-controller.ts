import {
  DomainError,
  routineDocumentSchema,
  type LocalDate,
  type RoutineDocument,
  type RoutineMetadata,
} from "@ritmo/core";
import type {
  DraftJournal,
  DraftStoragePort,
  StoredDraft,
} from "@ritmo/platform";

export interface RemoteDocument {
  routineId: string;
  document: RoutineDocument;
  revision: number;
}

export type SaveDocumentResult =
  | { kind: "saved"; revision: number }
  | { kind: "conflict"; actualRevision: number };

export interface DocumentPersistencePort {
  loadDocument(routineId: string): Promise<RemoteDocument>;
  saveDocument(input: {
    routineId: string;
    document: RoutineDocument;
    expectedRevision: number;
  }): Promise<SaveDocumentResult>;
  createFromDraft(input: {
    sourceRoutineId: string;
    document: RoutineDocument;
    metadata: Pick<
      RoutineMetadata,
      "name" | "icon" | "recurrenceType" | "specificDate"
    >;
    requestId: string;
  }): Promise<RemoteDocument>;
}

export type DraftFailureKind =
  | "storage"
  | "concurrent-local-writer"
  | "network"
  | "unauthenticated"
  | "not-found"
  | "rls"
  | "invalid-document"
  | "contract";

export interface DraftFailure {
  kind: DraftFailureKind;
  retryable: boolean;
  error?: Error;
}

export type DraftPhase =
  | "persisting"
  | "pending"
  | "saving"
  | "conflict"
  | "remote-error"
  | "storage-error"
  | "resolving";

export interface DraftRef {
  routineId: string;
  generation: number;
}

export interface PendingDraft extends DraftRef {
  baseRevision: number;
  localDate: LocalDate;
  updatedAt: number;
  phase: DraftPhase;
  locallyProtected: boolean;
  inFlightGeneration?: number;
  hasNewerChanges: boolean;
  failure?: DraftFailure;
}

export interface DraftControllerSnapshot {
  initialized: boolean;
  drafts: readonly PendingDraft[];
  hasPending: boolean;
  blocksExit: boolean;
}

export type FlushOutcome =
  | { kind: "clean"; routineId: string }
  | { kind: "synced"; routineId: string; revision: number }
  | { kind: "conflict"; draft: DraftRef; actualRevision: number }
  | { kind: "failed"; routineId: string; failure: DraftFailure };

export type RestoreDraftResult =
  | { kind: "remote"; document: RemoteDocument }
  | {
      kind: "restored-draft";
      document: RemoteDocument;
      generation: number;
    }
  | {
      kind: "conflict";
      remote: RemoteDocument;
      draft: DraftRef;
    };

interface DraftEntry {
  latest: DraftJournal;
  stored: StoredDraft | null;
  phase: DraftPhase;
  protectedGeneration: number;
  inFlightGeneration?: number;
  actualRevision?: number;
  failure?: DraftFailure;
  timer?: ReturnType<typeof setTimeout>;
  storageQueue: Promise<void>;
}

type Listener = () => void;

function toFailure(error: unknown, fallback: DraftFailureKind): DraftFailure {
  if (error instanceof DomainError) {
    const kindByCode: Partial<Record<typeof error.code, DraftFailureKind>> = {
      UNAUTHENTICATED: "unauthenticated",
      NOT_FOUND: "not-found",
      NETWORK: "network",
      RLS: "rls",
      INVALID_DOCUMENT: "invalid-document",
      STORAGE: "storage",
    };
    const kind = kindByCode[error.code] ?? fallback;
    return {
      kind,
      retryable:
        kind === "network" || kind === "unauthenticated" || kind === "storage",
      error,
    };
  }
  return {
    kind: fallback,
    retryable: fallback === "network" || fallback === "storage",
    error: error instanceof Error ? error : new Error(String(error)),
  };
}

export interface DraftControllerOptions {
  userId: string;
  storage: DraftStoragePort;
  remote: DocumentPersistencePort;
  debounceMs?: number;
  now?: () => number;
}

export interface DraftExitAdapter {
  inspectForExit(userId: string): Promise<{
    pendingCount: number;
    canSync: boolean;
  }>;
  syncAll(userId: string): Promise<boolean>;
  saveCopyAndDiscard(userId: string): Promise<void>;
  discardAll(userId: string): Promise<void>;
  lockForReauthentication(userId: string): Promise<void>;
}

export type DraftCopyMetadataResolver = (
  draft: DraftJournal,
) =>
  | Promise<
      Pick<RoutineMetadata, "name" | "icon" | "recurrenceType" | "specificDate">
    >
  | Pick<RoutineMetadata, "name" | "icon" | "recurrenceType" | "specificDate">;

async function draftCopyRequestId(value: string) {
  const digest = new Uint8Array(
    await globalThis.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(value),
    ),
  ).slice(0, 16);
  digest[6] = (digest[6] & 0x0f) | 0x80;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = [...digest].map((byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10).join(""),
  ].join("-");
}

export class DraftController {
  private readonly userId: string;
  private readonly storage: DraftStoragePort;
  private readonly remote: DocumentPersistencePort;
  private readonly debounceMs: number;
  private readonly now: () => number;
  private readonly entries = new Map<string, DraftEntry>();
  private readonly listeners = new Set<Listener>();
  private readonly saveRequested = new Set<string>();
  private readonly lastSyncedRevisions = new Map<string, number>();
  private initialized = false;
  private locked = false;
  private remoteDrain: Promise<void> | undefined;
  private remoteOperation: Promise<void> = Promise.resolve();

  constructor(options: DraftControllerOptions) {
    this.userId = options.userId;
    this.storage = options.storage;
    this.remote = options.remote;
    this.debounceMs = options.debounceMs ?? 750;
    this.now = options.now ?? Date.now;
  }

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): DraftControllerSnapshot => {
    const drafts = [...this.entries.values()]
      .map((entry) => this.toPendingDraft(entry))
      .sort(
        (left, right) =>
          left.updatedAt - right.updatedAt ||
          left.routineId.localeCompare(right.routineId),
      );
    return {
      initialized: this.initialized,
      drafts,
      hasPending: drafts.length > 0,
      blocksExit: drafts.length > 0 || !this.initialized,
    };
  };

  async initialize() {
    if (this.initialized) return;
    const storedDrafts = await this.storage.list(this.userId);
    for (const stored of storedDrafts) {
      const parsed = routineDocumentSchema.safeParse(
        stored.journal.documentEnvelope,
      );
      if (
        stored.journal.version !== 1 ||
        stored.journal.userId !== this.userId ||
        !Number.isSafeInteger(stored.journal.generation) ||
        stored.journal.generation < 1 ||
        !parsed.success
      ) {
        continue;
      }
      this.entries.set(stored.journal.routineId, {
        latest: { ...stored.journal, documentEnvelope: parsed.data },
        stored,
        phase: "pending",
        protectedGeneration: stored.journal.generation,
        storageQueue: Promise.resolve(),
      });
    }
    this.initialized = true;
    this.emit();
  }

  async restore(remote: RemoteDocument): Promise<RestoreDraftResult> {
    this.assertReady();
    this.lastSyncedRevisions.set(remote.routineId, remote.revision);
    const entry = this.entries.get(remote.routineId);
    if (!entry) return { kind: "remote", document: remote };
    if (entry.latest.baseRevision !== remote.revision) {
      entry.phase = "conflict";
      entry.actualRevision = remote.revision;
      this.emit();
      return {
        kind: "conflict",
        remote,
        draft: this.ref(entry),
      };
    }
    entry.phase = "pending";
    entry.actualRevision = undefined;
    entry.failure = undefined;
    this.schedule(entry);
    this.emit();
    return {
      kind: "restored-draft",
      document: {
        routineId: remote.routineId,
        document: entry.latest.documentEnvelope,
        revision: remote.revision,
      },
      generation: entry.latest.generation,
    };
  }

  async recordChange(input: {
    routineId: string;
    document: RoutineDocument;
    baseRevision: number;
    localDate: LocalDate;
  }): Promise<DraftRef> {
    this.assertReady();
    const document = routineDocumentSchema.parse(input.document);
    let entry = this.entries.get(input.routineId);
    const generation = (entry?.latest.generation ?? 0) + 1;
    if (!Number.isSafeInteger(generation)) {
      throw new DomainError(
        "STORAGE",
        "La generacion del draft excedio el limite seguro.",
      );
    }
    const journal: DraftJournal = {
      version: 1,
      userId: this.userId,
      routineId: input.routineId,
      baseRevision:
        entry?.latest.baseRevision ??
        this.lastSyncedRevisions.get(input.routineId) ??
        input.baseRevision,
      generation,
      documentEnvelope: document,
      localDate: input.localDate,
      updatedAt: this.now(),
    };

    if (!entry) {
      entry = {
        latest: journal,
        stored: null,
        phase: "persisting",
        protectedGeneration: 0,
        storageQueue: Promise.resolve(),
      };
      this.entries.set(input.routineId, entry);
    } else {
      entry.latest = journal;
      entry.phase = "persisting";
      entry.failure = undefined;
      this.clearTimer(entry);
    }
    this.emit();

    const currentEntry = entry;
    currentEntry.storageQueue = currentEntry.storageQueue
      .catch(() => undefined)
      .then(async () => {
        const journalToStore =
          currentEntry.latest.generation === journal.generation
            ? currentEntry.latest
            : journal;
        const result = await this.storage.compareExchange({
          userId: this.userId,
          routineId: input.routineId,
          expectedStorageVersion: currentEntry.stored?.storageVersion ?? null,
          next: journalToStore,
        });
        if (!result.applied || !result.current) {
          currentEntry.phase = "storage-error";
          currentEntry.failure = {
            kind: "concurrent-local-writer",
            retryable: false,
          };
          this.emit();
          throw new DomainError(
            "STORAGE",
            "Otro contexto modifico el draft local.",
          );
        }
        currentEntry.stored = result.current;
        currentEntry.protectedGeneration = Math.max(
          currentEntry.protectedGeneration,
          journalToStore.generation,
        );
        if (currentEntry.latest.generation === journal.generation) {
          currentEntry.phase = "pending";
          this.schedule(currentEntry);
        }
        this.emit();
      });

    try {
      await currentEntry.storageQueue;
    } catch (error) {
      if (currentEntry.phase !== "storage-error") {
        currentEntry.phase = "storage-error";
        currentEntry.failure = toFailure(error, "storage");
        this.emit();
      }
      throw error;
    }
    return { routineId: input.routineId, generation };
  }

  async protectLocal(routineId?: string) {
    this.assertReady();
    const entries = routineId
      ? [this.entries.get(routineId)].filter(
          (entry): entry is DraftEntry => entry !== undefined,
        )
      : [...this.entries.values()];
    await Promise.allSettled(entries.map((entry) => entry.storageQueue));
    return entries.map((entry) => this.toPendingDraft(entry));
  }

  async flushRoutine(routineId: string): Promise<FlushOutcome> {
    this.assertReady();
    const entry = this.entries.get(routineId);
    if (!entry) return { kind: "clean", routineId };
    this.clearTimer(entry);
    await entry.storageQueue.catch(() => undefined);
    if (entry.phase === "storage-error") return this.failedOutcome(entry);
    this.saveRequested.add(routineId);
    await this.startRemoteDrain();
    return this.outcomeFor(routineId);
  }

  async flushAll() {
    this.assertReady();
    const ids = [...this.entries.values()]
      .sort(
        (left, right) =>
          left.latest.updatedAt - right.latest.updatedAt ||
          left.latest.routineId.localeCompare(right.latest.routineId),
      )
      .map((entry) => entry.latest.routineId);
    return Promise.all(ids.map((id) => this.flushRoutine(id)));
  }

  async inspectPending() {
    this.assertReady();
    const localFailure = [...this.entries.values()].find(
      (entry) => entry.phase === "storage-error",
    )?.failure;
    if (localFailure) {
      return { kind: "failed" as const, failure: localFailure };
    }
    try {
      const stored = await this.storage.list(this.userId);
      return {
        kind: "ready" as const,
        drafts: stored.map(({ journal }) => journal),
      };
    } catch (error) {
      return {
        kind: "failed" as const,
        failure: toFailure(error, "storage"),
      };
    }
  }

  async loadRemoteForConflict(draft: DraftRef) {
    const entry = this.requireCurrent(draft);
    if (entry.phase !== "conflict") {
      throw new Error("El draft no esta en conflicto.");
    }
    return this.remote.loadDocument(draft.routineId);
  }

  async saveConflictAsNew(input: {
    draft: DraftRef;
    metadata: Pick<
      RoutineMetadata,
      "name" | "icon" | "recurrenceType" | "specificDate"
    >;
  }) {
    const entry = this.requireCurrent(input.draft);
    if (entry.phase !== "conflict") {
      throw new Error("El draft no esta listo para guardar como copia.");
    }
    return this.saveDraftAsNew(input);
  }

  async saveDraftAsNew(input: {
    draft: DraftRef;
    metadata: Pick<
      RoutineMetadata,
      "name" | "icon" | "recurrenceType" | "specificDate"
    >;
  }) {
    const entry = this.requireCurrent(input.draft);
    await entry.storageQueue;
    if (
      !entry.stored ||
      entry.stored.journal.generation !== input.draft.generation ||
      entry.protectedGeneration < input.draft.generation
    ) {
      throw new Error("El draft no esta protegido para guardar como copia.");
    }
    entry.phase = "resolving";
    this.emit();
    const captured = entry.stored;
    try {
      const created = await this.runRemote(() =>
        draftCopyRequestId(
          `${this.userId}:${input.draft.routineId}:${captured.storageVersion}`,
        ).then((requestId) =>
          this.remote.createFromDraft({
            sourceRoutineId: input.draft.routineId,
            document: captured.journal.documentEnvelope,
            metadata: input.metadata,
            requestId,
          }),
        ),
      );
      let removedCurrentDraft = false;
      entry.storageQueue = entry.storageQueue
        .catch(() => undefined)
        .then(async () => {
          const removed = await this.storage.compareExchange({
            userId: this.userId,
            routineId: input.draft.routineId,
            expectedStorageVersion: captured.storageVersion,
            next: null,
          });
          if (!removed.applied) return;
          if (entry.latest.generation === input.draft.generation) {
            removedCurrentDraft = true;
            this.entries.delete(input.draft.routineId);
            return;
          }
          entry.stored = null;
        });
      await entry.storageQueue;
      if (removedCurrentDraft) {
        this.emit();
        return { kind: "created" as const, routine: created };
      }
      if (this.entries.get(input.draft.routineId) === entry) {
        entry.phase = "pending";
      }
      this.emit();
      return {
        kind: "created-with-newer-draft" as const,
        routine: created,
        currentDraft: this.ref(entry),
      };
    } catch (error) {
      entry.phase = "remote-error";
      entry.failure = toFailure(error, "network");
      this.emit();
      return { kind: "failed" as const, failure: entry.failure };
    }
  }

  async discard(input: DraftRef & { confirmed: true }) {
    const entry = this.entries.get(input.routineId);
    if (
      !entry ||
      entry.latest.generation !== input.generation ||
      !entry.stored
    ) {
      return "superseded" as const;
    }
    const discardOperation = entry.storageQueue
      .catch(() => undefined)
      .then(async (): Promise<"discarded" | "superseded"> => {
        if (entry.latest.generation !== input.generation || !entry.stored) {
          return "superseded";
        }
        const result = await this.storage.compareExchange({
          userId: this.userId,
          routineId: input.routineId,
          expectedStorageVersion: entry.stored.storageVersion,
          next: null,
        });
        if (!result.applied) return "superseded";
        if (entry.latest.generation !== input.generation) {
          entry.stored = null;
          return "superseded";
        }
        this.clearTimer(entry);
        this.entries.delete(input.routineId);
        return "discarded";
      });
    entry.storageQueue = discardOperation.then(() => undefined);
    const outcome = await discardOperation;
    this.emit();
    return outcome;
  }

  async lockForSessionExpiry() {
    for (const entry of this.entries.values()) this.clearTimer(entry);
    await this.protectLocal();
    this.locked = true;
  }

  async dispose() {
    for (const entry of this.entries.values()) this.clearTimer(entry);
    await this.protectLocal().catch(() => undefined);
    this.listeners.clear();
  }

  private assertReady() {
    if (!this.initialized) throw new Error("DraftController no inicializado.");
    if (this.locked) throw new Error("DraftController bloqueado por sesion.");
  }

  private ref(entry: DraftEntry): DraftRef {
    return {
      routineId: entry.latest.routineId,
      generation: entry.latest.generation,
    };
  }

  private requireCurrent(ref: DraftRef) {
    this.assertReady();
    const entry = this.entries.get(ref.routineId);
    if (!entry || entry.latest.generation !== ref.generation) {
      throw new Error("La referencia de draft fue reemplazada.");
    }
    return entry;
  }

  private toPendingDraft(entry: DraftEntry): PendingDraft {
    return {
      ...this.ref(entry),
      baseRevision: entry.latest.baseRevision,
      localDate: entry.latest.localDate,
      updatedAt: entry.latest.updatedAt,
      phase: entry.phase,
      locallyProtected:
        entry.protectedGeneration >= entry.latest.generation &&
        entry.phase !== "storage-error",
      inFlightGeneration: entry.inFlightGeneration,
      hasNewerChanges:
        entry.inFlightGeneration !== undefined &&
        entry.latest.generation > entry.inFlightGeneration,
      failure: entry.failure,
    };
  }

  private schedule(entry: DraftEntry) {
    this.clearTimer(entry);
    entry.timer = setTimeout(() => {
      entry.timer = undefined;
      this.saveRequested.add(entry.latest.routineId);
      void this.startRemoteDrain();
    }, this.debounceMs);
  }

  private clearTimer(entry: DraftEntry) {
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = undefined;
  }

  private startRemoteDrain() {
    if (!this.remoteDrain) {
      const drain = this.drainRemote().finally(() => {
        if (this.remoteDrain === drain) this.remoteDrain = undefined;
      });
      this.remoteDrain = drain;
    }
    return this.remoteDrain;
  }

  private async drainRemote() {
    while (this.saveRequested.size > 0) {
      const routineId = this.saveRequested.values().next().value;
      if (!routineId) break;
      this.saveRequested.delete(routineId);
      const entry = this.entries.get(routineId);
      if (
        !entry ||
        entry.phase === "conflict" ||
        entry.phase === "storage-error"
      ) {
        continue;
      }
      await entry.storageQueue.catch(() => undefined);
      if (this.hasStorageFailure(entry) || !entry.stored) continue;

      const sent = entry.latest;
      entry.phase = "saving";
      entry.inFlightGeneration = sent.generation;
      entry.failure = undefined;
      this.emit();

      try {
        const result = await this.runRemote(() =>
          this.remote.saveDocument({
            routineId,
            document: sent.documentEnvelope,
            expectedRevision: sent.baseRevision,
          }),
        );
        if (result.kind === "conflict") {
          entry.phase = "conflict";
          entry.actualRevision = result.actualRevision;
          entry.inFlightGeneration = undefined;
          this.emit();
          continue;
        }
        if (result.revision <= sent.baseRevision) {
          throw new DomainError(
            "INVALID_DOCUMENT",
            "El repositorio devolvio una revision no avanzada.",
          );
        }

        entry.storageQueue = entry.storageQueue.then(async () => {
          if (!entry.stored) return;
          if (entry.latest.generation === sent.generation) {
            const storedVersion = entry.stored.storageVersion;
            const removed = await this.storage.compareExchange({
              userId: this.userId,
              routineId,
              expectedStorageVersion: storedVersion,
              next: null,
            });
            if (!removed.applied) {
              this.setConcurrentStorageFailure(entry);
              return;
            }
            this.lastSyncedRevisions.set(routineId, result.revision);
            if (entry.latest.generation === sent.generation) {
              this.entries.delete(routineId);
            } else {
              entry.latest = {
                ...entry.latest,
                baseRevision: result.revision,
              };
              entry.stored = null;
            }
            return;
          }

          const updated = {
            ...entry.latest,
            baseRevision: result.revision,
          };
          const stored = await this.storage.compareExchange({
            userId: this.userId,
            routineId,
            expectedStorageVersion: entry.stored.storageVersion,
            next: updated,
          });
          if (!stored.applied || !stored.current) {
            this.setConcurrentStorageFailure(entry);
            return;
          }
          this.lastSyncedRevisions.set(routineId, result.revision);
          entry.stored = stored.current;
          entry.protectedGeneration = updated.generation;
          if (entry.latest.generation === updated.generation) {
            entry.latest = updated;
            entry.phase = "pending";
            entry.inFlightGeneration = undefined;
            this.saveRequested.add(routineId);
          } else {
            entry.latest = {
              ...entry.latest,
              baseRevision: result.revision,
            };
          }
        });
        await entry.storageQueue;
        this.emit();
      } catch (error) {
        entry.phase = "remote-error";
        entry.inFlightGeneration = undefined;
        entry.failure = toFailure(error, "network");
        this.emit();
      }
    }
  }

  private runRemote<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.remoteOperation.then(operation, operation);
    this.remoteOperation = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private setConcurrentStorageFailure(entry: DraftEntry) {
    entry.phase = "storage-error";
    entry.inFlightGeneration = undefined;
    entry.failure = {
      kind: "concurrent-local-writer",
      retryable: false,
    };
  }

  private hasStorageFailure(entry: DraftEntry) {
    return entry.phase === "storage-error";
  }

  private outcomeFor(routineId: string): FlushOutcome {
    const entry = this.entries.get(routineId);
    if (!entry) {
      const revision = this.lastSyncedRevisions.get(routineId);
      return revision === undefined
        ? { kind: "clean", routineId }
        : { kind: "synced", routineId, revision };
    }
    if (entry.phase === "conflict") {
      return {
        kind: "conflict",
        draft: this.ref(entry),
        actualRevision: entry.actualRevision ?? entry.latest.baseRevision,
      };
    }
    if (entry.phase === "remote-error" || entry.phase === "storage-error") {
      return this.failedOutcome(entry);
    }
    return { kind: "clean", routineId };
  }

  private failedOutcome(entry: DraftEntry): FlushOutcome {
    return {
      kind: "failed",
      routineId: entry.latest.routineId,
      failure: entry.failure ?? {
        kind: "contract",
        retryable: false,
      },
    };
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }
}

export function createDraftExitAdapter(options: {
  userId: string;
  controller: DraftController;
  resolveCopyMetadata: DraftCopyMetadataResolver;
}): DraftExitAdapter {
  const assertUser = (userId: string) => {
    if (userId !== options.userId) {
      throw new Error("El contexto de drafts pertenece a otro usuario.");
    }
  };

  return {
    async inspectForExit(userId) {
      assertUser(userId);
      const inspected = await options.controller.inspectPending();
      if (inspected.kind === "failed") {
        return { pendingCount: 1, canSync: false };
      }
      const snapshot = options.controller.getSnapshot();
      return {
        pendingCount: inspected.drafts.length,
        canSync:
          snapshot.drafts.length === inspected.drafts.length &&
          snapshot.drafts.every(
            (draft) =>
              draft.locallyProtected &&
              draft.phase !== "conflict" &&
              draft.phase !== "storage-error",
          ),
      };
    },

    async syncAll(userId) {
      assertUser(userId);
      const outcomes = await options.controller.flushAll();
      return outcomes.every(
        (outcome) => outcome.kind === "clean" || outcome.kind === "synced",
      );
    },

    async saveCopyAndDiscard(userId) {
      assertUser(userId);
      await options.controller.protectLocal();
      const inspected = await options.controller.inspectPending();
      if (inspected.kind === "failed") {
        throw (
          inspected.failure.error ??
          new Error("No se pudieron leer los drafts.")
        );
      }
      for (const journal of inspected.drafts) {
        const result = await options.controller.saveDraftAsNew({
          draft: {
            routineId: journal.routineId,
            generation: journal.generation,
          },
          metadata: await options.resolveCopyMetadata(journal),
        });
        if (result.kind !== "created") {
          throw new Error(
            "Un draft nuevo aparecio mientras se guardaba la copia.",
          );
        }
      }
    },

    async discardAll(userId) {
      assertUser(userId);
      await options.controller.protectLocal();
      const drafts = options.controller.getSnapshot().drafts;
      for (const draft of drafts) {
        const result = await options.controller.discard({
          routineId: draft.routineId,
          generation: draft.generation,
          confirmed: true,
        });
        if (result !== "discarded") {
          throw new Error("Un draft nuevo aparecio durante el descarte.");
        }
      }
    },

    async lockForReauthentication(userId) {
      assertUser(userId);
      await options.controller.lockForSessionExpiry();
    },
  };
}
