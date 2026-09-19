import { describe, expect, it, vi } from "vitest";
import { createLifecycleController } from "@ritmo/platform";

import { LocalDateObserver } from "./local-date-observer";

describe("LocalDateObserver", () => {
  it("recalculates local date at the scheduled boundary and on resume", async () => {
    const lifecycle = createLifecycleController();
    const dates = ["2026-09-18", "2026-09-19"] as const;
    let dateIndex = 0;
    let scheduled: (() => void) | undefined;
    const cancel = vi.fn();
    const observer = new LocalDateObserver({
      lifecycle,
      getDate: () => dates[dateIndex],
      getDelay: () => 100,
      schedule: (callback) => {
        scheduled = callback;
        return 1 as unknown as ReturnType<typeof setTimeout>;
      },
      cancel,
    });
    const listener = vi.fn();
    const resumed = vi.fn();
    const unsubscribeResume = observer.subscribeResume(resumed);
    const unsubscribe = observer.subscribe(listener);

    expect(listener).toHaveBeenLastCalledWith("2026-09-18");
    dateIndex = 1;
    scheduled?.();
    expect(listener).toHaveBeenLastCalledWith("2026-09-19");

    await lifecycle.emit("resume");
    expect(resumed).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribeResume();
    unsubscribe();
    expect(cancel).toHaveBeenCalled();
  });

  it("does not duplicate lifecycle subscriptions", async () => {
    const lifecycle = createLifecycleController();
    const observer = new LocalDateObserver({
      lifecycle,
      getDate: () => "2026-09-18",
      getDelay: () => 100,
      schedule: () => 1 as unknown as ReturnType<typeof setTimeout>,
    });
    const resumed = vi.fn();
    observer.subscribeResume(resumed);
    const unsubscribeA = observer.subscribe(vi.fn());
    const unsubscribeB = observer.subscribe(vi.fn());

    await lifecycle.emit("resume");
    expect(resumed).toHaveBeenCalledOnce();

    unsubscribeA();
    unsubscribeB();
  });
});
