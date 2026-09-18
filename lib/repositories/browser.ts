"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { getAuthenticatedUser } from "@/lib/supabase/user";

import { createRepositories } from "./create";

export async function createBrowserRepositories() {
  const client = createBrowserSupabaseClient();
  await getAuthenticatedUser(client);
  return createRepositories(client);
}
