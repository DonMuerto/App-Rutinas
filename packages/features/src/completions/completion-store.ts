import { completionKeySchema, type LocalDate } from "@ritmo/core";

import type { CompletionMutationRepository } from "../contracts";

export type CompletionTarget = Omit<
  ReturnType<typeof completionKeySchema.parse>,
  "completionDate"
>;

export interface CompletionSnapshot {
  readonly target: CompletionTarget;
  readonly completed: boolean;
}

export interface CompletionState {
  readonly completed: boolean;
  readonly pending: boolean;
}

const INCOMPLETE_STATE: CompletionState = Object.freeze({
  completed: false,
  pending: false,
});

function completionIdentity(
  userId: string,
  target: CompletionTarget,
  date: LocalDate,
) {
  return JSON.stringify([
    userId,
    date,
    target.routineId,
    target.scopeActivityBlockId,
    target.blockId,
    target.blockType,
  ]);
}

function userPrefix(userId: string) {
  return JSON.stringify([userId]).slice(0, -1);
}

export class CompletionStore {
  private readonly states = new Map<string, CompletionState>();
  private readonly listeners = new Set<() => void>();
  private readonly announcements = new Map<string, string>();
  private readonly revisions = new Map<string, number>();
  private readonly pendingMutations = new Map<string, AbortController>();

  constructor(private readonly repository: CompletionMutationRepository) {}

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState(userId: string, target: CompletionTarget, date: LocalDate) {
    return (
      this.states.get(completionIdentity(userId, target, date)) ??
      INCOMPLETE_STATE
    );
  }

  getAnnouncement(userId: string) {
    return this.announcements.get(userId) ?? "";
  }

  getRevision(userId: string) {
    return this.revisions.get(userId) ?? 0;
  }

  hydrate(
    userId: string,
    date: LocalDate,
    completions: readonly CompletionSnapshot[],
    startedAtRevision = this.getRevision(userId),
  ) {
    if (startedAtRevision !== this.getRevision(userId)) return;
    let changed = false;

    for (const completion of completions) {
      const key = completionIdentity(userId, completion.target, date);
      const current = this.states.get(key);
      if (current?.pending || current?.completed === completion.completed)
        continue;

      this.states.set(key, {
        completed: completion.completed,
        pending: false,
      });
      changed = true;
    }

    if (changed) this.emit();
  }

  async toggle(userId: string, target: CompletionTarget, date: LocalDate) {
    const completion = completionKeySchema.parse({
      ...target,
      completionDate: date,
    });
    const key = completionIdentity(userId, target, date);
    const previous = this.states.get(key) ?? INCOMPLETE_STATE;
    if (previous.pending) return previous.completed;

    const completed = !previous.completed;
    const controller = new AbortController();
    this.pendingMutations.set(key, controller);
    this.revisions.set(userId, this.getRevision(userId) + 1);
    this.announcements.set(userId, "");
    this.states.set(key, { completed, pending: true });
    this.emit();

    try {
      if (completed) {
        await this.repository.mark(completion, controller.signal);
      } else {
        await this.repository.unmark(completion, controller.signal);
      }

      if (
        controller.signal.aborted ||
        this.pendingMutations.get(key) !== controller
      ) {
        return completed;
      }

      this.states.set(key, { completed, pending: false });
      this.pendingMutations.delete(key);
      this.emit();
      return completed;
    } catch {
      if (
        controller.signal.aborted ||
        this.pendingMutations.get(key) !== controller
      ) {
        return previous.completed;
      }

      this.states.set(key, previous);
      this.pendingMutations.delete(key);
      this.announcements.set(
        userId,
        "No pudimos guardar el cambio. Restauramos el estado anterior.",
      );
      this.emit();
      return previous.completed;
    }
  }

  clearUser(userId: string) {
    const prefix = userPrefix(userId);
    for (const [key, controller] of this.pendingMutations) {
      if (key.startsWith(prefix)) {
        controller.abort();
        this.pendingMutations.delete(key);
      }
    }
    for (const key of this.states.keys()) {
      if (key.startsWith(prefix)) this.states.delete(key);
    }
    this.announcements.delete(userId);
    this.revisions.delete(userId);
    this.emit();
  }

  clearAll() {
    for (const controller of this.pendingMutations.values()) controller.abort();
    this.pendingMutations.clear();
    this.states.clear();
    this.announcements.clear();
    this.revisions.clear();
    this.emit();
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }
}
