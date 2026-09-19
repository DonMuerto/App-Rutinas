import { DomainError } from "@ritmo/core";
import type { SecureStoragePort } from "@ritmo/platform";
import type { SupportedStorage } from "@supabase/supabase-js";

export const AUTH_STORAGE_KEY = "ritmo.supabase.session.v1";

function storageError(error: unknown) {
  return new DomainError(
    "STORAGE",
    "No se pudo acceder al almacenamiento seguro de la sesion.",
    { cause: error },
  );
}

export async function clearStoredAuthSession(storage: SecureStoragePort) {
  try {
    await storage.remove(AUTH_STORAGE_KEY);
  } catch (error) {
    throw storageError(error);
  }
}

export function createSecureStorageAdapter(
  storage: SecureStoragePort,
): SupportedStorage {
  return {
    async getItem(key) {
      try {
        return await storage.get(key);
      } catch (error) {
        throw storageError(error);
      }
    },
    async setItem(key, value) {
      try {
        await storage.set(key, value);
      } catch (error) {
        throw storageError(error);
      }
    },
    async removeItem(key) {
      try {
        await storage.remove(key);
      } catch (error) {
        throw storageError(error);
      }
    },
  };
}
