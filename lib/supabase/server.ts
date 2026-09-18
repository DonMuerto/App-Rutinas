import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "./database.types";
import { getSupabaseEnvironment } from "./env";

async function createServerClientWithCookies(ignoreWriteErrors: boolean) {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnvironment();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        if (ignoreWriteErrors) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot write cookies; proxy.ts performs refreshes.
          }
          return;
        }

        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}

export async function createServerSupabaseClient() {
  return createServerClientWithCookies(true);
}

export async function createServerActionSupabaseClient() {
  return createServerClientWithCookies(false);
}
