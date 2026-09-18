import type { CompletionKey, LocalDate } from "@/lib/contracts";
import type { CompletionRepository } from "@/lib/repositories";

export type CompletionTarget = Omit<CompletionKey, "completionDate">;

export interface CompletionSnapshot {
  target: CompletionTarget;
  completed: boolean;
}

export interface CompletionState {
  completed: boolean;
  pending: boolean;
}

export type CompletionMutationRepository = Pick<
  CompletionRepository,
  "mark" | "unmark"
>;

export interface DailyCompletionCache {
  getRevision(): number;
  hydrate(
    date: LocalDate,
    completions: readonly CompletionSnapshot[],
    startedAtRevision?: number,
  ): void;
  getState(target: CompletionTarget, date: LocalDate): CompletionState;
  getAnnouncement(): string;
  subscribe(listener: () => void): () => void;
  toggle(target: CompletionTarget, date: LocalDate): Promise<boolean>;
}
