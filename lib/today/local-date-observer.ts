import { getLocalDate } from "@/lib/dates";
import type { LocalDate } from "@/lib/contracts";

const MAXIMUM_CHECK_INTERVAL_MS = 60_000;

interface VisibilitySource {
  isVisible(): boolean;
  subscribe(listener: () => void): () => void;
}

interface LocalDateObserverOptions {
  getDate?: () => LocalDate;
  getDelay?: () => number;
  schedule?: (
    callback: () => void,
    delay: number,
  ) => ReturnType<typeof setTimeout>;
  cancel?: (timer: ReturnType<typeof setTimeout>) => void;
  visibility?: VisibilitySource;
}

function millisecondsUntilNextLocalDay(now: Date) {
  const nextDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );

  return Math.max(1, nextDay.getTime() - now.getTime() + 25);
}

function createBrowserVisibilitySource(): VisibilitySource | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }

  return {
    isVisible: () => document.visibilityState === "visible",
    subscribe(listener) {
      document.addEventListener("visibilitychange", listener);
      return () => document.removeEventListener("visibilitychange", listener);
    },
  };
}

export class LocalDateObserver {
  private readonly listeners = new Set<(date: LocalDate) => void>();
  private readonly getDate: () => LocalDate;
  private readonly getDelay: () => number;
  private readonly schedule: NonNullable<LocalDateObserverOptions["schedule"]>;
  private readonly cancel: NonNullable<LocalDateObserverOptions["cancel"]>;
  private readonly visibility: VisibilitySource | undefined;
  private currentDate: LocalDate | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribeVisibility: (() => void) | null = null;

  constructor(options: LocalDateObserverOptions = {}) {
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
    this.visibility = options.visibility ?? createBrowserVisibilitySource();
  }

  subscribe(listener: (date: LocalDate) => void) {
    this.listeners.add(listener);

    if (this.listeners.size === 1) {
      this.unsubscribeVisibility =
        this.visibility?.subscribe(() => {
          if (this.visibility?.isVisible()) {
            this.refresh();
          }
        }) ?? null;
      this.refresh();
    } else if (this.currentDate) {
      listener(this.currentDate);
    }

    return () => {
      this.listeners.delete(listener);

      if (this.listeners.size === 0) {
        this.stop();
      }
    };
  }

  getCurrentDate() {
    return this.currentDate ?? this.getDate();
  }

  refresh() {
    const nextDate = this.getDate();

    if (nextDate !== this.currentDate) {
      this.currentDate = nextDate;
      for (const listener of this.listeners) {
        listener(nextDate);
      }
    }

    this.reschedule();
    return nextDate;
  }

  private reschedule() {
    if (this.listeners.size === 0) return;

    if (this.timer !== null) {
      this.cancel(this.timer);
    }

    this.timer = this.schedule(() => {
      this.timer = null;
      this.refresh();
    }, this.getDelay());
  }

  private stop() {
    if (this.timer !== null) {
      this.cancel(this.timer);
      this.timer = null;
    }

    this.unsubscribeVisibility?.();
    this.unsubscribeVisibility = null;
    this.currentDate = null;
  }
}
