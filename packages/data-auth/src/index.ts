import type { SecureStoragePort } from "@ritmo/platform";
import type { QueryClient } from "@tanstack/react-query";

import { createAuthService, type AuthService } from "./auth-service";
import {
  createSupabaseDataClient,
  getSupabaseEnvironment,
  type SupabaseEnvironment,
} from "./client";
import { createRepositoryServices } from "./repositories";
import { subscribeToUserQueryCleanup } from "./query-keys";
import type { Repositories } from "./types";

export interface DataAuthServices {
  auth: AuthService;
  repositories: Repositories;
  dispose(): void;
}

export function createDataAuthServices(options: {
  secureStorage: SecureStoragePort;
  queryClient: QueryClient;
  environment?: SupabaseEnvironment;
}): DataAuthServices {
  const client = createSupabaseDataClient(
    options.environment ?? getSupabaseEnvironment(),
    options.secureStorage,
  );
  const auth = createAuthService(client, options.secureStorage);
  const repositoryServices = createRepositoryServices(client);
  const stopQueryCleanup = subscribeToUserQueryCleanup(
    auth,
    options.queryClient,
    repositoryServices.clearUserData,
  );

  return {
    auth,
    repositories: repositoryServices.repositories,
    dispose() {
      stopQueryCleanup();
      auth.dispose();
    },
  };
}

export type {
  AuthListener,
  AuthService,
  AuthSnapshot,
  AuthStatus,
  AuthUser,
} from "./auth-service";
export type { SupabaseEnvironment } from "./client";
export {
  clearUserQueryData,
  completionKeys,
  repositoryInvalidations,
  routineKeys,
} from "./query-keys";
export { AUTH_STORAGE_KEY } from "./storage";
export type {
  BlockCompletion,
  CompletionRepository,
  CreateRoutineFromDraftInput,
  CreateRoutineInput,
  Repositories,
  RoutineRecurrence,
  RoutineRepository,
} from "./types";
