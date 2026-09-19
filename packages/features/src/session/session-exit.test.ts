import { describe, expect, it, vi } from "vitest";

import type {
  AuthServicePort,
  DraftExitControllerPort,
  QueryCachePort,
  TimerControllerPort,
} from "../contracts";
import { CompletionStore } from "../completions/completion-store";
import { SessionExitCoordinator } from "./session-exit";

function setup(options?: {
  readonly pendingCount?: number;
  readonly syncResult?: boolean;
  readonly decision?:
    | "sync"
    | "save-copy"
    | "discard"
    | "cancel"
    | Promise<"sync" | "save-copy" | "discard" | "cancel">;
  readonly timerFailure?: boolean;
}) {
  const calls: string[] = [];
  const auth: AuthServicePort = {
    async login() {},
    async register() {},
    async logout() {
      calls.push("auth");
    },
  };
  const drafts: DraftExitControllerPort = {
    async inspectForExit() {
      calls.push("inspect");
      return {
        pendingCount: options?.pendingCount ?? 1,
        canSync: true,
      };
    },
    async syncAll() {
      calls.push("sync");
      return options?.syncResult ?? true;
    },
    async saveCopyAndDiscard() {
      calls.push("save-copy");
    },
    async discardAll() {
      calls.push("discard");
    },
    async lockForReauthentication() {
      calls.push("lock");
    },
  };
  const timer: TimerControllerPort = {
    getSnapshot: () => ({ status: "idle" }),
    subscribe: () => () => {},
    async start() {
      return { ok: true };
    },
    openFocus() {},
    async clearForUser() {
      calls.push("timer");
      if (options?.timerFailure) throw new Error("timer storage failed");
    },
  };
  const completions = new CompletionStore({
    async mark() {},
    async unmark() {},
  });
  const originalClear = completions.clearUser.bind(completions);
  vi.spyOn(completions, "clearUser").mockImplementation((userId) => {
    calls.push("completions");
    originalClear(userId);
  });
  const queryCache: QueryCachePort = {
    async cancelUserQueries() {
      calls.push("query-cancel");
    },
    clearUser() {
      calls.push("query-clear");
    },
  };
  const coordinator = new SessionExitCoordinator({
    auth,
    completions,
    drafts,
    queryCache,
    timer,
    requestDecision: async () => await (options?.decision ?? "sync"),
  });
  return { calls, coordinator };
}

describe("SessionExitCoordinator", () => {
  it("resolves drafts and clears user state before low-level logout", async () => {
    const { calls, coordinator } = setup({ decision: "save-copy" });

    await expect(coordinator.logout("user-a")).resolves.toBe("logged-out");
    expect(calls.slice(0, 2)).toEqual(["inspect", "save-copy"]);
    expect(calls.at(-1)).toBe("auth");
    expect(calls.slice(2, -1).sort()).toEqual(
      ["timer", "completions", "query-cancel", "query-clear"].sort(),
    );
  });

  it("does not clear state when the user cancels or sync fails", async () => {
    const cancelled = setup({ decision: "cancel" });
    await expect(cancelled.coordinator.logout("user-a")).resolves.toBe(
      "cancelled",
    );
    expect(cancelled.calls).toEqual(["inspect"]);

    const blocked = setup({ decision: "sync", syncResult: false });
    await expect(blocked.coordinator.logout("user-a")).resolves.toBe("blocked");
    expect(blocked.calls).toEqual(["inspect", "sync"]);
  });

  it("locks drafts on expiration without calling logout", async () => {
    const { calls, coordinator } = setup();

    await coordinator.handleExpiration("user-a");

    expect(calls[0]).toBe("lock");
    expect(calls.slice(1).sort()).toEqual(
      ["timer", "completions", "query-cancel", "query-clear"].sort(),
    );
  });

  it("queues expiration while a logout decision is open", async () => {
    let resolveDecision!: (decision: "cancel") => void;
    const decision = new Promise<"cancel">((resolve) => {
      resolveDecision = resolve;
    });
    const { calls, coordinator } = setup({ decision });

    const logout = coordinator.logout("user-a");
    await vi.waitFor(() => expect(calls).toEqual(["inspect"]));
    const expiration = coordinator.handleExpiration("user-a");
    resolveDecision("cancel");

    await expect(logout).resolves.toBe("cancelled");
    await expect(expiration).resolves.toBeUndefined();
    expect(calls.slice(0, 2)).toEqual(["inspect", "lock"]);
    expect(calls.slice(2).sort()).toEqual(
      ["timer", "completions", "query-cancel", "query-clear"].sort(),
    );
  });

  it("clears other user state and credentials when one cleanup fails", async () => {
    const { calls, coordinator } = setup({
      pendingCount: 0,
      timerFailure: true,
    });

    await expect(coordinator.logout("user-a")).rejects.toThrow(
      "timer storage failed",
    );
    expect(calls).toContain("completions");
    expect(calls).toContain("query-clear");
    expect(calls.at(-1)).toBe("auth");
  });
});
