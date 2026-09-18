import type { User } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "./server";
import { getAuthenticatedUser } from "./user";

export async function getCurrentUser(): Promise<User | null> {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.auth.getUser();

  if (error) {
    return null;
  }

  return data.user;
}

export async function requireUser(): Promise<User> {
  const client = await createServerSupabaseClient();
  return getAuthenticatedUser(client);
}

export { getAuthenticatedUser } from "./user";
