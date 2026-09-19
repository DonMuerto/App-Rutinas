import type { SecureStoragePort } from "@ritmo/platform";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";
import { AUTH_STORAGE_KEY, createSecureStorageAdapter } from "./storage";

export interface SupabaseEnvironment {
  url: string;
  anonKey: string;
}

export function getSupabaseEnvironment(
  environment: Record<string, string | undefined> = import.meta.env,
): SupabaseEnvironment {
  const url = environment.VITE_SUPABASE_URL;
  const anonKey = environment.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY son obligatorias.",
    );
  }

  return { url, anonKey };
}

export function createSupabaseDataClient(
  environment: SupabaseEnvironment,
  secureStorage: SecureStoragePort,
) {
  return createClient<Database>(environment.url, environment.anonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
      storage: createSecureStorageAdapter(secureStorage),
      storageKey: AUTH_STORAGE_KEY,
    },
  });
}

export type DataClient = ReturnType<typeof createSupabaseDataClient>;
