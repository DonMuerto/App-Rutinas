import type { SecureStoragePort } from "@ritmo/platform";
import { describe, expect, it } from "vitest";

import { getSupabaseEnvironment } from "./client";
import { AUTH_STORAGE_KEY, createSecureStorageAdapter } from "./storage";

function memoryStorage() {
  const values = new Map<string, string>();
  const storage: SecureStoragePort = {
    async get(key) {
      return values.get(key) ?? null;
    },
    async set(key, value) {
      values.set(key, value);
    },
    async remove(key) {
      values.delete(key);
    },
  };
  return { storage, values };
}

describe("Supabase secure storage", () => {
  it("adapts the platform port without choosing a native implementation", async () => {
    const { storage, values } = memoryStorage();
    const adapter = createSecureStorageAdapter(storage);

    await adapter.setItem(AUTH_STORAGE_KEY, "session");
    expect(await adapter.getItem(AUTH_STORAGE_KEY)).toBe("session");
    await adapter.removeItem(AUTH_STORAGE_KEY);
    expect(values.size).toBe(0);
  });

  it("reads only the public Vite environment", () => {
    expect(
      getSupabaseEnvironment({
        VITE_SUPABASE_URL: "http://127.0.0.1:54321",
        VITE_SUPABASE_ANON_KEY: "public-anon-key",
      }),
    ).toEqual({
      url: "http://127.0.0.1:54321",
      anonKey: "public-anon-key",
    });
    expect(() => getSupabaseEnvironment({})).toThrow(/VITE_SUPABASE/);
  });
});
