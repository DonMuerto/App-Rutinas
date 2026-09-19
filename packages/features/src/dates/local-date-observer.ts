import { getLocalDate, type LocalDate } from "@ritmo/core";
import type { LifecyclePort } from "@ritmo/platform";

const MAXIMUM_CHECK_INTERVAL_MS = 60_000;

export interface LocalDateObserverOptions {
  readonly lifecycle: LifecyclePort;
  readonly getDate?: () => LocalDate;
  readonly getDelay?: () => number;
  readonly schedule?: (
    callback: () => void,
    delay: number,
  ) => ReturnType<typeof setTimeout>;
  readonly cancel?: (timer: ReturnType<typeof setTimeout>) => void;
}

function millisecondsUntilNextLocalDay(now: Date) {
  const nextDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );
  return Math.max(1, nextDay.getTime() - now.getTime() + 25);
}

export class LocalDateObserver {
  private readonly listeners = new Set<(date: LocalDate) => void>();
  private readonly resumeListeners = new Set<() => void>();
  private readonly getDate: () => LocalDate;
  private readonly getDelay: () => number;
  private readonly schedule: NonNullable<LocalDateObserverOptions["schedule"]>;
  private readonly cancel: NonNullable<LocalDateObserverOptions["cancel"]>;
  private readonly lifecycle: LifecyclePort;
  private currentDate: LocalDate | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribeLifecycle: (() => void) | null = null;

  constructor(options: LocalDateObserverOptions) {
    this.lifecycle = options.lifecycle;
    this.getDate = options.getDate ?? (() => getLocalDate());
    this.getDelay =
      options.getDelay ??
      (() =>
        Math.min(
          millisecondsUntilNextLocalDay(new Date()),
          MAXIMUM_CHECK_INTERVAL_MS,
        ));
    this.schedule =
      options.schedule ?? ((callback, delay) => setTimeout(callback, delay));
    this.cancel = options.cancel ?? ((timer) => clearTimeout(timer));
  }

  subscribe(listener: (date: LocalDate) => void) {
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      this.unsubscribeLifecycle = this.lifecycle.subscribe((event) => {
        if (event === "active" || event === "resume") {
          this.refresh();
          if (event === "resume") {
            for (const resumeListener of this.resumeListeners) resumeListener();
          }
        }
      });
      this.refresh();
    } else if (this.currentDate) {
      listener(this.currentDate);
    }

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stop();
    };
  }

  subscribeResume(listener: () => void) {
    this.resumeListeners.add(listener);
    return () => {
      this.resumeListeners.delete(listener);
    };
  }

  getCurrentDate() {
    return this.currentDate ?? this.getDate();
  }

  refresh() {
    const nextDate = this.getDate();
    if (nextDate !== this.currentDate) {
      this.currentDate = nextDate;
      for (const listener of this.listeners) listener(nextDate);
    }
    this.reschedule();
    return nextDate;
  }

  private reschedule() {
    if (this.listeners.size === 0) return;
    if (this.timer !== null) this.cancel(this.timer);
    this.timer = this.schedule(() => {
      this.timer = null;
      this.refresh();
    }, this.getDelay());
  }

  private stop() {
    if (this.timer !== null) this.cancel(this.timer);
    this.timer = null;
    this.unsubscribeLifecycle?.();
    this.unsubscribeLifecycle = null;
    this.currentDate = null;
  }
}
