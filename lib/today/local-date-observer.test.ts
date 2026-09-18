import { describe, expect, it, vi } from "vitest";

import type { LocalDate } from "@/lib/contracts";

import { LocalDateObserver } from "./local-date-observer";

describe("LocalDateObserver", () => {
  it("publishes a new cache date after midnight without touching the prior day", () => {
    let date: LocalDate = "2026-09-13";
    let scheduledCheck: (() => void) | undefined;
    const observer = new LocalDateObserver({
      getDate: () => date,
      getDelay: () => 100,
      schedule: (callback) => {
        scheduledCheck = callback;
        return 1 as unknown as ReturnType<typeof setTimeout>;
      },
      cancel: vi.fn(),
    });
    const listener = vi.fn();
    const unsubscribe = observer.subscribe(listener);

    date = "2026-09-14";
    scheduledCheck?.();

    expect(listener.mock.calls).toEqual([["2026-09-13"], ["2026-09-14"]]);
    unsubscribe();
  });

  it("rechecks the local date after visibility recovers, including a zone change", () => {
    let date: LocalDate = "2026-09-13";
    let visible = false;
    let visibilityListener: (() => void) | undefined;
    const unsubscribeVisibility = vi.fn();
    const observer = new LocalDateObserver({
      getDate: () => date,
      getDelay: () => 60_000,
      schedule: () => 1 as unknown as ReturnType<typeof setTimeout>,
      cancel: vi.fn(),
      visibility: {
        isVisible: () => visible,
        subscribe: (listener) => {
          visibilityListener = listener;
          return unsubscribeVisibility;
        },
      },
    });
    const listener = vi.fn();
    const unsubscribe = observer.subscribe(listener);

    date = "2026-09-14";
    visibilityListener?.();
    expect(listener).toHaveBeenCalledTimes(1);

    visible = true;
    visibilityListener?.();
    expect(listener).toHaveBeenLastCalledWith("2026-09-14");

    unsubscribe();
    expect(unsubscribeVisibility).toHaveBeenCalledOnce();
  });
});
