import type {
  CompletionKey,
  LocalDate,
  Routine,
  RoutineDocument,
  RoutineMetadata,
} from "@ritmo/core";

export type RoutineRecurrence = Pick<
  Routine,
  "recurrenceType" | "specificDate"
>;

export type CreateRoutineInput = RoutineRecurrence & {
  name: string;
  icon?: string | null;
};

export interface CreateRoutineFromDraftInput {
  sourceRoutineId: string;
  document: RoutineDocument;
  metadata: Pick<
    RoutineMetadata,
    "name" | "icon" | "recurrenceType" | "specificDate"
  >;
  requestId: string;
}

export type BlockCompletion = CompletionKey & {
  id: string;
  completedAt: string;
};

export interface RoutineRepository {
  listMetadata(): Promise<RoutineMetadata[]>;
  getById(id: string): Promise<Routine>;
  create(input: CreateRoutineInput): Promise<Routine>;
  createFromDraft(input: CreateRoutineFromDraftInput): Promise<Routine>;
  rename(id: string, name: string): Promise<void>;
  updateIcon(id: string, icon: string | null): Promise<void>;
  updateRecurrence(id: string, recurrence: RoutineRecurrence): Promise<void>;
  saveDocument(
    id: string,
    expectedRevision: number,
    content: RoutineDocument,
  ): Promise<number>;
  reorder(orderedIds: string[]): Promise<void>;
  delete(id: string): Promise<void>;
  listForDate(date: LocalDate): Promise<Routine[]>;
}

export interface CompletionRepository {
  list(
    routineIds: string[],
    completionDate: LocalDate,
  ): Promise<BlockCompletion[]>;
  mark(completion: CompletionKey, signal?: AbortSignal): Promise<void>;
  unmark(completion: CompletionKey, signal?: AbortSignal): Promise<void>;
}

export interface Repositories {
  routines: RoutineRepository;
  completions: CompletionRepository;
}
