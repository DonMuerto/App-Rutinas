import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/supabase/user";

import { createRepositories } from "./create";

export async function createServerRepositories() {
  const client = await createServerSupabaseClient();
  await getAuthenticatedUser(client);
  return createRepositories(client);
}
