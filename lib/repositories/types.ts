import type {
  CompletionKey,
  LocalDate,
  Routine,
  RoutineDocument,
  RoutineMetadata,
} from "@/lib/contracts";

export type RoutineRecurrence = Pick<
  Routine,
  "recurrenceType" | "specificDate"
>;

export type CreateRoutineInput = RoutineRecurrence & {
  name: string;
  icon?: string | null;
};

export type BlockCompletion = CompletionKey & {
  id: string;
  completedAt: string;
};

export interface RoutineRepository {
  listMetadata(): Promise<RoutineMetadata[]>;
  getById(id: string): Promise<Routine>;
  create(input: CreateRoutineInput): Promise<Routine>;
  rename(id: string, name: string): Promise<void>;
  updateIcon(id: string, icon: string | null): Promise<void>;
  updateRecurrence(id: string, recurrence: RoutineRecurrence): Promise<void>;
  saveDocument(id: string, content: RoutineDocument): Promise<void>;
  reorder(orderedIds: string[]): Promise<void>;
  delete(id: string): Promise<void>;
  listForDate(date: LocalDate): Promise<Routine[]>;
}

export interface CompletionRepository {
  list(
    routineIds: string[],
    completionDate: LocalDate,
  ): Promise<BlockCompletion[]>;
  mark(completion: CompletionKey): Promise<void>;
  unmark(completion: CompletionKey): Promise<void>;
}

export interface Repositories {
  routines: RoutineRepository;
  completions: CompletionRepository;
}
