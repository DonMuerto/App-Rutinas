import type { LocalDate } from "@ritmo/core";
import type { QueryClient } from "@tanstack/react-query";

import type { AuthService } from "./auth-service";

const userRoot = (userId: string) => ["user", userId] as const;

export const routineKeys = {
  all: (userId: string) => [...userRoot(userId), "routines"] as const,
  metadata: (userId: string) =>
    [...routineKeys.all(userId), "metadata"] as const,
  detail: (userId: string, routineId: string) =>
    [...routineKeys.all(userId), "detail", routineId] as const,
  today: (userId: string, date: LocalDate) =>
    [...routineKeys.all(userId), "today", date] as const,
};

export const completionKeys = {
  all: (userId: string) => [...userRoot(userId), "completions"] as const,
  forDate: (userId: string, date: LocalDate, routineIds: string[]) =>
    [...completionKeys.all(userId), date, [...routineIds].sort()] as const,
};

function invalidateToday(
  queryClient: QueryClient,
  userId: string,
  date?: LocalDate,
) {
  return queryClient.invalidateQueries({
    queryKey:
      date === undefined
        ? ([...routineKeys.all(userId), "today"] as const)
        : routineKeys.today(userId, date),
  });
}

export function clearUserQueryData(queryClient: QueryClient, userId: string) {
  queryClient.removeQueries({ queryKey: userRoot(userId) });
}

export function subscribeToUserQueryCleanup(
  auth: Pick<AuthService, "subscribe">,
  queryClient: QueryClient,
  clearAdditionalUserData?: (userId: string) => void,
) {
  return auth.subscribe((snapshot, previous) => {
    if (previous.user && previous.user.id !== snapshot.user?.id) {
      clearUserQueryData(queryClient, previous.user.id);
      clearAdditionalUserData?.(previous.user.id);
    }
  });
}

export const repositoryInvalidations = {
  async routineCreated(queryClient: QueryClient, userId: string) {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: routineKeys.metadata(userId),
      }),
      invalidateToday(queryClient, userId),
    ]);
  },

  async routineMetadataChanged(
    queryClient: QueryClient,
    userId: string,
    routineId: string,
  ) {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: routineKeys.metadata(userId),
      }),
      queryClient.invalidateQueries({
        queryKey: routineKeys.detail(userId, routineId),
      }),
      invalidateToday(queryClient, userId),
    ]);
  },

  async routineDocumentSaved(
    queryClient: QueryClient,
    userId: string,
    routineId: string,
  ) {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: routineKeys.detail(userId, routineId),
      }),
      invalidateToday(queryClient, userId),
    ]);
  },

  async routinesReordered(queryClient: QueryClient, userId: string) {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: routineKeys.metadata(userId),
      }),
      queryClient.invalidateQueries({
        queryKey: [...routineKeys.all(userId), "detail"] as const,
      }),
      invalidateToday(queryClient, userId),
    ]);
  },

  async routineDeleted(
    queryClient: QueryClient,
    userId: string,
    routineId: string,
  ) {
    queryClient.removeQueries({
      queryKey: routineKeys.detail(userId, routineId),
    });
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: routineKeys.metadata(userId),
      }),
      invalidateToday(queryClient, userId),
    ]);
  },

  async completionChanged(
    queryClient: QueryClient,
    userId: string,
    date: LocalDate,
  ) {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: [...completionKeys.all(userId), date] as const,
      }),
      invalidateToday(queryClient, userId, date),
    ]);
  },
};
