import { DomainError } from "@ritmo/core";
import type { SecureStoragePort } from "@ritmo/platform";
import type {
  AuthChangeEvent,
  Session,
  Subscription,
} from "@supabase/supabase-js";

import type { DataClient } from "./client";
import { dataError } from "./errors";
import { clearStoredAuthSession } from "./storage";

export type AuthStatus =
  | "initializing"
  | "anonymous"
  | "authenticated"
  | "refreshing"
  | "session-expired"
  | "credentials-invalid"
  | "network-error";

export interface AuthUser {
  id: string;
  email?: string;
}

export interface AuthSnapshot {
  status: AuthStatus;
  user: AuthUser | null;
}

export type AuthListener = (
  snapshot: AuthSnapshot,
  previous: AuthSnapshot,
) => void;

export interface AuthService {
  getSnapshot(): AuthSnapshot;
  subscribe(listener: AuthListener): () => void;
  initialize(): Promise<AuthSnapshot>;
  register(email: string, password: string): Promise<AuthUser>;
  login(email: string, password: string): Promise<AuthUser>;
  refresh(): Promise<AuthSnapshot>;
  requireUser(): AuthUser;
  logout(): Promise<void>;
  dispose(): void;
}

function authUser(session: Session): AuthUser {
  return {
    id: session.user.id,
    email: session.user.email,
  };
}

function invalidCredentials(cause: unknown) {
  return new DomainError("UNAUTHENTICATED", "Email o contrasena incorrectos.", {
    cause,
  });
}

function isExpiredSessionError(error: { status?: number } | null) {
  return error?.status === 400 || error?.status === 401;
}

function expiredSession(cause: unknown) {
  return new DomainError(
    "UNAUTHENTICATED",
    "Tu sesion no es valida o ha expirado.",
    { cause },
  );
}

class SupabaseAuthService implements AuthService {
  private snapshot: AuthSnapshot = { status: "initializing", user: null };
  private readonly listeners = new Set<AuthListener>();
  private readonly subscription: Subscription;
  private initialized = false;
  private explicitLogout = false;

  constructor(
    private readonly client: DataClient,
    private readonly secureStorage: SecureStoragePort,
  ) {
    const { data } = client.auth.onAuthStateChange((event, session) => {
      this.onAuthEvent(event, session);
    });
    this.subscription = data.subscription;
  }

  getSnapshot() {
    return this.snapshot;
  }

  subscribe(listener: AuthListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async initialize() {
    const { data: sessionData, error: sessionError } =
      await this.client.auth.getSession();

    if (sessionError) {
      return this.fail(
        isExpiredSessionError(sessionError)
          ? "session-expired"
          : "network-error",
        sessionError,
      );
    }

    if (!sessionData.session) {
      this.initialized = true;
      return this.publish({ status: "anonymous", user: null });
    }

    const { data, error } = await this.client.auth.getUser();

    if (error) {
      this.initialized = true;
      return this.fail(
        isExpiredSessionError(error) ? "session-expired" : "network-error",
        error,
      );
    }

    if (!data.user) {
      this.initialized = true;
      return this.fail("session-expired", null);
    }

    this.initialized = true;
    return this.publish({
      status: "authenticated",
      user: { id: data.user.id, email: data.user.email },
    });
  }

  async register(email: string, password: string) {
    const { data, error } = await this.client.auth.signUp({ email, password });

    if (error) {
      return this.failAuthOperation(error);
    }

    if (!data.session) {
      const configurationError = new DomainError(
        "VALIDATION",
        "El registro requiere confirmacion de email, deshabilitada en el MVP.",
      );
      this.publish({ status: "anonymous", user: null });
      throw configurationError;
    }

    const user = authUser(data.session);
    this.publish({ status: "authenticated", user });
    return user;
  }

  async login(email: string, password: string) {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return this.failAuthOperation(error);
    }

    const user = authUser(data.session);
    this.publish({ status: "authenticated", user });
    return user;
  }

  async refresh() {
    const previousUser = this.snapshot.user;
    this.publish({ status: "refreshing", user: previousUser });
    const { data, error } = await this.client.auth.refreshSession();

    if (error) {
      return this.fail(
        isExpiredSessionError(error) ? "session-expired" : "network-error",
        error,
      );
    }

    if (!data.session) {
      return this.fail("session-expired", null);
    }

    return this.publish({
      status: "authenticated",
      user: authUser(data.session),
    });
  }

  requireUser() {
    if (this.snapshot.status !== "authenticated" || !this.snapshot.user) {
      throw new DomainError(
        "UNAUTHENTICATED",
        "Debes iniciar sesion para acceder a este recurso.",
      );
    }

    return this.snapshot.user;
  }

  async logout() {
    this.explicitLogout = true;
    try {
      let signOutError: unknown;
      try {
        const result = await this.client.auth.signOut();
        signOutError = result.error;
      } catch (error) {
        signOutError = error;
      }

      this.publish({ status: "anonymous", user: null });
      await clearStoredAuthSession(this.secureStorage);
      if (signOutError) {
        return this.fail("network-error", signOutError);
      }
    } finally {
      this.explicitLogout = false;
    }
  }

  dispose() {
    this.subscription.unsubscribe();
    this.listeners.clear();
  }

  private onAuthEvent(event: AuthChangeEvent, session: Session | null) {
    if (!this.initialized && event === "INITIAL_SESSION") {
      return;
    }

    if (event === "SIGNED_OUT") {
      this.publish({
        status:
          this.explicitLogout || !this.snapshot.user
            ? "anonymous"
            : "session-expired",
        user: null,
      });
      return;
    }

    if (
      session &&
      (event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED")
    ) {
      this.publish({ status: "authenticated", user: authUser(session) });
    }
  }

  private failAuthOperation(error: { status?: number }): never {
    if (error.status === 400) {
      this.publish({ status: "credentials-invalid", user: null });
      throw invalidCredentials(error);
    }

    return this.fail("network-error", error);
  }

  private fail(
    status: "network-error" | "session-expired",
    error: unknown,
  ): never {
    this.publish({ status, user: null });
    throw status === "session-expired"
      ? expiredSession(error)
      : dataError(error);
  }

  private publish(snapshot: AuthSnapshot) {
    const previous = this.snapshot;
    this.snapshot = snapshot;

    for (const listener of this.listeners) {
      listener(snapshot, previous);
    }

    return snapshot;
  }
}

export function createAuthService(
  client: DataClient,
  secureStorage: SecureStoragePort,
): AuthService {
  return new SupabaseAuthService(client, secureStorage);
}
