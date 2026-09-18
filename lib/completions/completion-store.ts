import {
  completionKeySchema,
  type CompletionKey,
  type LocalDate,
} from "@/lib/contracts";

import type {
  CompletionMutationRepository,
  CompletionSnapshot,
  CompletionState,
  CompletionTarget,
  DailyCompletionCache,
} from "./types";

const INCOMPLETE_STATE: CompletionState = Object.freeze({
  completed: false,
  pending: false,
});

function identityKey(target: CompletionTarget, date: LocalDate) {
  return JSON.stringify([
    date,
    target.routineId,
    target.scopeActivityBlockId,
    target.blockId,
    target.blockType,
  ]);
}

export class CompletionStore implements DailyCompletionCache {
  private readonly states = new Map<string, CompletionState>();
  private readonly listeners = new Set<() => void>();
  private announcement = "";
  private revision = 0;

  constructor(private readonly repository: CompletionMutationRepository) {}

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState(target: CompletionTarget, date: LocalDate) {
    return this.states.get(identityKey(target, date)) ?? INCOMPLETE_STATE;
  }

  getAnnouncement = () => this.announcement;

  getRevision = () => this.revision;

  hydrate(
    date: LocalDate,
    completions: readonly CompletionSnapshot[],
    startedAtRevision = this.revision,
  ) {
    if (startedAtRevision !== this.revision) {
      return;
    }

    let changed = false;

    for (const completion of completions) {
      const key = identityKey(completion.target, date);
      const current = this.states.get(key);

      if (current?.pending || current?.completed === completion.completed) {
        continue;
      }

      this.states.set(key, {
        completed: completion.completed,
        pending: false,
      });
      changed = true;
    }

    if (changed) {
      this.emit();
    }
  }

  async toggle(target: CompletionTarget, date: LocalDate) {
    const parsedKey: CompletionKey = completionKeySchema.parse({
      ...target,
      completionDate: date,
    });
    const cacheKey = identityKey(target, date);
    const previous = this.states.get(cacheKey) ?? INCOMPLETE_STATE;

    if (previous.pending) {
      return previous.completed;
    }

    const completed = !previous.completed;
    this.revision += 1;
    this.announcement = "";
    this.states.set(cacheKey, { completed, pending: true });
    this.emit();

    try {
      if (completed) {
        await this.repository.mark(parsedKey);
      } else {
        await this.repository.unmark(parsedKey);
      }

      this.states.set(cacheKey, { completed, pending: false });
      this.emit();
      return completed;
    } catch {
      this.states.set(cacheKey, {
        completed: previous.completed,
        pending: false,
      });
      this.announcement =
        "No pudimos guardar el cambio. Restauramos el estado anterior.";
      this.emit();
      return previous.completed;
    }
  }

  private emit() {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
