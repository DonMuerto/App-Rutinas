import { describe, expect, it, vi } from "vitest";

import { AutosaveController } from "./autosave";

describe("AutosaveController", () => {
  it("debounces edits and saves only the latest document", async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(undefined);
    const controller = new AutosaveController(save, 750);

    controller.change("first");
    controller.change("latest");
    expect(controller.getSnapshot().status).toBe("pending");

    await vi.advanceTimersByTimeAsync(750);

    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith("latest");
    expect(controller.getSnapshot()).toMatchObject({
      status: "saved",
      hasUnsavedChanges: false,
    });
    controller.dispose();
    vi.useRealTimers();
  });

  it("retains the latest local edit after a failed save and retries it", async () => {
    const save = vi
      .fn<(value: string) => Promise<void>>()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue(undefined);
    const controller = new AutosaveController(save, 750);
    controller.change("local document");

    await expect(controller.flush()).rejects.toThrow("network");
    expect(controller.getSnapshot()).toMatchObject({
      status: "error",
      hasUnsavedChanges: true,
    });

    await controller.retry();
    expect(save).toHaveBeenLastCalledWith("local document");
    expect(controller.getSnapshot().status).toBe("saved");
  });

  it("flushes a newer edit that arrives during an in-flight save", async () => {
    let resolveFirst: (() => void) | undefined;
    const save = vi.fn((value: string) =>
      value === "first"
        ? new Promise<void>((resolve) => {
            resolveFirst = resolve;
          })
        : Promise.resolve(),
    );
    const controller = new AutosaveController(save);
    controller.change("first");
    const flush = controller.flush();
    controller.change("second");
    resolveFirst?.();
    await flush;

    expect(save.mock.calls).toEqual([["first"], ["second"]]);
    expect(controller.getSnapshot().hasUnsavedChanges).toBe(false);
  });

  it("shares one drain and does not report saved while its latest save runs", async () => {
    let resolveFirst: (() => void) | undefined;
    let resolveSecond: (() => void) | undefined;
    const save = vi.fn(
      (value: string) =>
        new Promise<void>((resolve) => {
          if (value === "first") resolveFirst = resolve;
          else resolveSecond = resolve;
        }),
    );
    const controller = new AutosaveController(save);
    controller.change("first");
    const firstFlush = controller.flush();
    controller.change("second");
    const concurrentFlush = controller.flush();

    expect(concurrentFlush).toBe(firstFlush);
    resolveFirst?.();
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(controller.getSnapshot()).toMatchObject({
      status: "saving",
      hasUnsavedChanges: true,
    });

    resolveSecond?.();
    await concurrentFlush;
    expect(controller.getSnapshot()).toMatchObject({
      status: "saved",
      hasUnsavedChanges: false,
    });
  });

  it("tracks a failed metadata write until the field commits it again", async () => {
    const operation = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("metadata offline"))
      .mockResolvedValue(undefined);
    const controller = new AutosaveController(vi.fn());

    await expect(controller.track(operation)).rejects.toThrow(
      "metadata offline",
    );
    expect(controller.getSnapshot().hasUnsavedChanges).toBe(true);

    await expect(controller.retry()).rejects.toThrow("metadata offline");
    await controller.track(operation);
    expect(operation).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot()).toMatchObject({
      status: "saved",
      hasUnsavedChanges: false,
    });
  });

  it("guards an uncommitted metadata draft until that key persists", async () => {
    const controller = new AutosaveController(vi.fn());
    controller.setExternalDirty("routine-name", true);

    expect(controller.getSnapshot()).toMatchObject({
      status: "pending",
      hasUnsavedChanges: true,
    });
    await expect(controller.flush()).rejects.toThrow(
      "Hay cambios de la cabecera pendientes de guardar.",
    );

    await controller.track(() => Promise.resolve(), "routine-name");
    expect(controller.getSnapshot()).toMatchObject({
      status: "saved",
      hasUnsavedChanges: false,
    });
  });
});
