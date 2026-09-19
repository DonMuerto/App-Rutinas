import type { QueryClient } from "@tanstack/react-query";

import type { QueryCachePort } from "../contracts";

function belongsToUser(queryKey: readonly unknown[], userId: string) {
  return (
    queryKey[0] === userId || (queryKey[0] === "user" && queryKey[1] === userId)
  );
}

export function createQueryCachePort(queryClient: QueryClient): QueryCachePort {
  return {
    async cancelUserQueries(userId) {
      await queryClient.cancelQueries({
        predicate: (query) => belongsToUser(query.queryKey, userId),
      });
    },
    clearUser(userId) {
      queryClient.removeQueries({
        predicate: (query) => belongsToUser(query.queryKey, userId),
      });
    },
  };
}
