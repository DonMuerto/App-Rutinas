export type AutosaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export interface AutosaveSnapshot {
  readonly status: AutosaveStatus;
  readonly hasUnsavedChanges: boolean;
  readonly error?: Error;
}

type Listener = (snapshot: AutosaveSnapshot) => void;
type ExternalOperation = () => Promise<void>;
type ExternalOperationKey = string | ExternalOperation;

export class AutosaveController<Value> {
  private pending: { value: Value } | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private drainPromise: Promise<void> | undefined;
  private externalRequests = new Set<Promise<void>>();
  private failedExternalOperations = new Map<
    ExternalOperationKey,
    { operation: ExternalOperation; error: Error }
  >();
  private externalDirtyKeys = new Set<string>();
  private listeners = new Set<Listener>();
  private save: (value: Value) => Promise<void>;
  private snapshot: AutosaveSnapshot = {
    status: "idle",
    hasUnsavedChanges: false,
  };

  constructor(
    save: (value: Value) => Promise<void>,
    private readonly delay = 750,
  ) {
    this.save = save;
  }

  setSave(save: (value: Value) => Promise<void>) {
    this.save = save;
  }

  getSnapshot = () => this.snapshot;

  canRetry = () => this.pending !== undefined;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  change(value: Value) {
    this.pending = { value };
    this.setSnapshot({ status: "pending", hasUnsavedChanges: true });
    this.schedule();
  }

  setExternalDirty(key: string, dirty: boolean) {
    if (dirty) {
      this.externalDirtyKeys.add(key);
      this.setSnapshot({ status: "pending", hasUnsavedChanges: true });
      return;
    }

    this.externalDirtyKeys.delete(key);
    this.failedExternalOperations.delete(key);
    if (
      this.externalDirtyKeys.size === 0 &&
      this.externalRequests.size === 0 &&
      this.failedExternalOperations.size === 0 &&
      !this.pending &&
      !this.drainPromise
    ) {
      this.setSnapshot({ status: "saved", hasUnsavedChanges: false });
    }
  }

  flush(): Promise<void> {
    this.clearTimer();

    if (!this.drainPromise) {
      const drain = this.drain().finally(() => {
        if (this.drainPromise === drain) {
          this.drainPromise = undefined;
        }
      });
      this.drainPromise = drain;
    }

    return this.drainPromise;
  }

  track(
    operation: ExternalOperation,
    key: ExternalOperationKey = operation,
  ): Promise<void> {
    this.failedExternalOperations.delete(key);
    const request = Promise.resolve().then(operation);
    this.externalRequests.add(request);
    this.setSnapshot({ status: "saving", hasUnsavedChanges: true });

    return request.then(
      () => {
        this.externalRequests.delete(request);
        this.failedExternalOperations.delete(key);
        if (typeof key === "string") this.externalDirtyKeys.delete(key);
        if (
          this.externalRequests.size === 0 &&
          this.externalDirtyKeys.size === 0 &&
          !this.pending &&
          !this.drainPromise &&
          this.failedExternalOperations.size === 0
        ) {
          this.setSnapshot({ status: "saved", hasUnsavedChanges: false });
        }
      },
      (cause: unknown) => {
        this.externalRequests.delete(request);
        const error = cause instanceof Error ? cause : new Error(String(cause));
        this.failedExternalOperations.set(key, { operation, error });
        this.setSnapshot({
          status: "error",
          hasUnsavedChanges: true,
          error,
        });
        throw error;
      },
    );
  }

  private async drain(): Promise<void> {
    while (true) {
      while (this.externalRequests.size > 0) {
        await Promise.allSettled([...this.externalRequests]);
      }

      const externalFailure = this.failedExternalOperations
        .values()
        .next().value;
      if (externalFailure) {
        throw externalFailure.error;
      }

      if (this.externalDirtyKeys.size > 0) {
        throw new Error("Hay cambios de la cabecera pendientes de guardar.");
      }

      if (this.pending) {
        this.clearTimer();
        const pending = this.pending;
        this.pending = undefined;
        this.setSnapshot({ status: "saving", hasUnsavedChanges: true });

        const request = this.save(pending.value);

        try {
          await request;
        } catch (cause) {
          if (!this.pending) {
            this.pending = pending;
          }
          const error =
            cause instanceof Error ? cause : new Error(String(cause));
          this.setSnapshot({
            status: "error",
            hasUnsavedChanges: true,
            error,
          });
          throw error;
        }
        continue;
      }

      break;
    }

    this.setSnapshot({ status: "saved", hasUnsavedChanges: false });
  }

  retry() {
    if (this.failedExternalOperations.size > 0) {
      const failure = this.failedExternalOperations.values().next().value;
      return Promise.reject(
        failure?.error ?? new Error("La cabecera tiene cambios pendientes."),
      );
    }

    return this.flush();
  }

  dispose() {
    this.clearTimer();
    this.listeners.clear();
  }

  private schedule() {
    this.clearTimer();
    this.timer = setTimeout(() => {
      void this.flush().catch(() => undefined);
    }, this.delay);
  }

  private clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  private setSnapshot(snapshot: AutosaveSnapshot) {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener(snapshot));
  }
}
