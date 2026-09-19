import type { SecureStoragePort } from "@ritmo/platform";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { createAuthService } from "./auth-service";
import type { DataClient } from "./client";
import { AUTH_STORAGE_KEY } from "./storage";

const USER_ID = "11111111-1111-4111-8111-111111111111";

function session() {
  return {
    access_token: "access",
    expires_in: 3600,
    expires_at: 1_800_000_000,
    refresh_token: "refresh",
    token_type: "bearer",
    user: { id: USER_ID, email: "a@ritmo.local" },
  };
}

type FakeAuthResponse = {
  data: {
    session: ReturnType<typeof session> | null;
    user: ReturnType<typeof session>["user"] | null;
  };
  error: { status: number; message: string } | null;
};

type FakeGetUserResponse = {
  data: { user: ReturnType<typeof session>["user"] | null };
  error: { status: number; message: string } | null;
};

function authHarness() {
  const remove = vi.fn(async () => undefined);
  const storage: SecureStoragePort = {
    get: vi.fn(async () => null),
    set: vi.fn(async () => undefined),
    remove,
  };
  const unsubscribe = vi.fn();
  let authCallback:
    ((event: AuthChangeEvent, session: Session | null) => void) | undefined;
  const signInWithPassword = vi.fn(async (): Promise<FakeAuthResponse> => ({
    data: { session: session(), user: session().user },
    error: null,
  }));
  const refreshSession = vi.fn(async (): Promise<FakeAuthResponse> => ({
    data: { session: session(), user: session().user },
    error: null,
  }));
  const getUser = vi.fn(async (): Promise<FakeGetUserResponse> => ({
    data: { user: session().user },
    error: null,
  }));
  const auth = {
    onAuthStateChange: vi.fn(
      (callback: (event: AuthChangeEvent, session: Session | null) => void) => {
        authCallback = callback;
        return {
          data: { subscription: { id: "auth", callback, unsubscribe } },
        };
      },
    ),
    getSession: vi.fn(async () => ({
      data: { session: session() },
      error: null,
    })),
    getUser,
    signUp: vi.fn(async () => ({
      data: { session: session(), user: session().user },
      error: null,
    })),
    signInWithPassword,
    refreshSession,
    signOut: vi.fn(async () => ({ error: null })),
  };
  const client = { auth } as unknown as DataClient;
  return {
    auth,
    client,
    emit(event: AuthChangeEvent, nextSession: Session | null) {
      authCallback?.(event, nextSession);
    },
    remove,
    storage,
    unsubscribe,
  };
}

describe("AuthService", () => {
  it("validates a restored session before publishing authenticated state", async () => {
    const { auth, client, storage } = authHarness();
    const service = createAuthService(client, storage);
    const listener = vi.fn();
    service.subscribe(listener);

    await expect(service.initialize()).resolves.toEqual({
      status: "authenticated",
      user: { id: USER_ID, email: "a@ritmo.local" },
    });
    expect(auth.getSession).toHaveBeenCalledOnce();
    expect(auth.getUser).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(service.getSnapshot(), {
      status: "initializing",
      user: null,
    });
  });

  it("publishes invalid credentials without exposing provider details", async () => {
    const { auth, client, storage } = authHarness();
    auth.signInWithPassword.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { status: 400, message: "provider detail" },
    });
    const service = createAuthService(client, storage);

    await expect(
      service.login("bad@ritmo.local", "wrong"),
    ).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      message: "Email o contrasena incorrectos.",
    });
    expect(service.getSnapshot()).toEqual({
      status: "credentials-invalid",
      user: null,
    });
  });

  it("refreshes on demand and clears only the pre-auth session key on logout", async () => {
    const { auth, client, remove, storage, unsubscribe } = authHarness();
    const service = createAuthService(client, storage);
    await service.initialize();

    await expect(service.refresh()).resolves.toMatchObject({
      status: "authenticated",
    });
    await service.logout();

    expect(auth.refreshSession).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith(AUTH_STORAGE_KEY);
    expect(service.getSnapshot()).toEqual({ status: "anonymous", user: null });
    service.dispose();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("reports an invalid refresh token as an expired session", async () => {
    const { auth, client, storage } = authHarness();
    auth.refreshSession.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { status: 400, message: "invalid refresh token" },
    });
    const service = createAuthService(client, storage);

    await expect(service.refresh()).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      message: "Tu sesion no es valida o ha expirado.",
    });
    expect(service.getSnapshot()).toEqual({
      status: "session-expired",
      user: null,
    });
  });

  it("normalizes secure-storage failures and remains logged out", async () => {
    const { client, remove, storage } = authHarness();
    remove.mockRejectedValueOnce(new Error("keychain unavailable"));
    const service = createAuthService(client, storage);
    await service.initialize();

    await expect(service.logout()).rejects.toMatchObject({ code: "STORAGE" });
    expect(service.getSnapshot()).toEqual({ status: "anonymous", user: null });
  });

  it("classifies getUser transport failures as network errors", async () => {
    const { auth, client, storage } = authHarness();
    auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { status: 503, message: "unavailable" },
    });
    const service = createAuthService(client, storage);

    await expect(service.initialize()).rejects.toMatchObject({
      code: "NETWORK",
    });
    expect(service.getSnapshot()).toEqual({
      status: "network-error",
      user: null,
    });
  });

  it("resets explicit logout when signOut throws", async () => {
    const { auth, client, emit, remove, storage } = authHarness();
    auth.signOut.mockRejectedValueOnce(new Error("storage failed"));
    const service = createAuthService(client, storage);
    await service.initialize();

    await expect(service.logout()).rejects.toMatchObject({ code: "NETWORK" });
    expect(remove).toHaveBeenCalledWith("ritmo.supabase.session.v1");
    await service.login("a@ritmo.local", "secret");
    emit("SIGNED_OUT", null);

    expect(service.getSnapshot()).toEqual({
      status: "session-expired",
      user: null,
    });
  });
});
