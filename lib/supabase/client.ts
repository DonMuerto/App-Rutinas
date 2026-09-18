"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./database.types";
import { getSupabaseEnvironment } from "./env";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createBrowserSupabaseClient() {
  if (!browserClient) {
    const { url, anonKey } = getSupabaseEnvironment();
    browserClient = createBrowserClient<Database>(url, anonKey);
  }

  return browserClient;
}
