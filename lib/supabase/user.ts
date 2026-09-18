import type { SupabaseClient, User } from "@supabase/supabase-js";

import { DomainError } from "@/lib/contracts";

import type { Database } from "./database.types";

export async function getAuthenticatedUser(
  client: SupabaseClient<Database>,
): Promise<User> {
  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    throw new DomainError(
      "UNAUTHENTICATED",
      "Tu sesion no es valida o ha expirado.",
      error ? { cause: error } : undefined,
    );
  }

  return data.user;
}
