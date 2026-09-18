import type { QueryClient } from "@tanstack/react-query";

import type { LocalDate } from "@/lib/contracts";

export const routineKeys = {
  all: ["routines"] as const,
  metadata: () => [...routineKeys.all, "metadata"] as const,
  detail: (routineId: string) =>
    [...routineKeys.all, "detail", routineId] as const,
  today: (date: LocalDate) => [...routineKeys.all, "today", date] as const,
};

export const completionKeys = {
  all: ["completions"] as const,
  forDate: (date: LocalDate, routineIds: string[]) =>
    [...completionKeys.all, date, [...routineIds].sort()] as const,
};

function invalidateToday(queryClient: QueryClient, date?: LocalDate) {
  return queryClient.invalidateQueries({
    queryKey:
      date === undefined
        ? ([...routineKeys.all, "today"] as const)
        : routineKeys.today(date),
  });
}

export const repositoryInvalidations = {
  async routineCreated(queryClient: QueryClient) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: routineKeys.metadata() }),
      invalidateToday(queryClient),
    ]);
  },

  async routineRenamed(queryClient: QueryClient, routineId: string) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: routineKeys.metadata() }),
      queryClient.invalidateQueries({
        queryKey: routineKeys.detail(routineId),
      }),
      invalidateToday(queryClient),
    ]);
  },

  async routineIconChanged(queryClient: QueryClient, routineId: string) {
    await repositoryInvalidations.routineRenamed(queryClient, routineId);
  },

  async routineRecurrenceChanged(queryClient: QueryClient, routineId: string) {
    await repositoryInvalidations.routineRenamed(queryClient, routineId);
  },

  async routineDocumentSaved(queryClient: QueryClient, routineId: string) {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: routineKeys.detail(routineId),
      }),
      invalidateToday(queryClient),
    ]);
  },

  async routinesReordered(queryClient: QueryClient) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: routineKeys.metadata() }),
      queryClient.invalidateQueries({
        queryKey: [...routineKeys.all, "detail"] as const,
      }),
      invalidateToday(queryClient),
    ]);
  },

  async routineDeleted(queryClient: QueryClient, routineId: string) {
    queryClient.removeQueries({ queryKey: routineKeys.detail(routineId) });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: routineKeys.metadata() }),
      invalidateToday(queryClient),
    ]);
  },

  async completionChanged(queryClient: QueryClient, date: LocalDate) {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: [...completionKeys.all, date] as const,
      }),
      invalidateToday(queryClient, date),
    ]);
  },
};
