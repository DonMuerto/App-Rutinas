import type {
  AuthServicePort,
  DraftExitControllerPort,
  QueryCachePort,
  SessionExitDecisionPrompt,
  TimerControllerPort,
} from "../contracts";
import type { CompletionStore } from "../completions/completion-store";

export type SessionExitResult =
  "logged-out" | "cancelled" | "blocked" | "already-running";

export interface SessionExitDependencies {
  readonly auth: AuthServicePort;
  readonly completions: CompletionStore;
  readonly drafts: DraftExitControllerPort;
  readonly queryCache: QueryCachePort;
  readonly timer: TimerControllerPort;
  readonly requestDecision: SessionExitDecisionPrompt;
}

export class SessionExitCoordinator {
  private running = false;
  private pendingExpiration:
    | {
        readonly userId: string;
        readonly promise: Promise<void>;
        readonly resolve: () => void;
        readonly reject: (reason: unknown) => void;
      }
    | undefined;

  constructor(private readonly dependencies: SessionExitDependencies) {}

  async logout(userId: string): Promise<SessionExitResult> {
    if (this.running) return "already-running";
    this.running = true;

    try {
      const draftState = await this.dependencies.drafts.inspectForExit(userId);
      if (draftState.pendingCount > 0) {
        const decision = await this.dependencies.requestDecision(draftState);
        if (decision === "cancel") return "cancelled";

        if (decision === "sync") {
          const synced = await this.dependencies.drafts.syncAll(userId);
          if (!synced) return "blocked";
        } else if (decision === "save-copy") {
          await this.dependencies.drafts.saveCopyAndDiscard(userId);
        } else {
          await this.dependencies.drafts.discardAll(userId);
        }
      }

      let cleanupError: unknown;
      try {
        await this.clearUserRuntime(userId);
      } catch (error) {
        cleanupError = error;
      }
      await this.dependencies.auth.logout();
      if (cleanupError) throw cleanupError;
      return "logged-out";
    } finally {
      this.finishRun();
    }
  }

  handleExpiration(userId: string): Promise<void> {
    if (this.running) {
      if (this.pendingExpiration?.userId === userId) {
        return this.pendingExpiration.promise;
      }
      if (this.pendingExpiration) {
        return this.pendingExpiration.promise.then(() =>
          this.handleExpiration(userId),
        );
      }
      let resolve!: () => void;
      let reject!: (reason: unknown) => void;
      const promise = new Promise<void>((onResolve, onReject) => {
        resolve = onResolve;
        reject = onReject;
      });
      this.pendingExpiration = { userId, promise, resolve, reject };
      return promise;
    }
    return this.runExpiration(userId);
  }

  private async runExpiration(userId: string) {
    this.running = true;
    try {
      await this.dependencies.drafts.lockForReauthentication(userId);
      await this.clearUserRuntime(userId);
    } finally {
      this.finishRun();
    }
  }

  private async clearUserRuntime(userId: string) {
    const results = await Promise.allSettled([
      this.dependencies.timer.clearForUser(userId),
      Promise.resolve().then(() =>
        this.dependencies.completions.clearUser(userId),
      ),
      (async () => {
        try {
          await this.dependencies.queryCache.cancelUserQueries(userId);
        } finally {
          this.dependencies.queryCache.clearUser(userId);
        }
      })(),
    ]);
    const failure = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (failure) throw failure.reason;
  }

  private finishRun() {
    this.running = false;
    const pending = this.pendingExpiration;
    if (!pending) return;
    this.pendingExpiration = undefined;
    void this.runExpiration(pending.userId).then(
      pending.resolve,
      pending.reject,
    );
  }
}
