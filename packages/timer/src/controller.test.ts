import { describe, expect, it, vi } from "vitest";

import { createFakePlatformServices } from "@ritmo/platform/fakes";

import { createTimerController } from "./controller";

const origin = {
  activityId: "activity-a",
  activityTitle: "Lectura",
  routineId: "routine-a",
  routineName: "Noche",
} as const;

function countdownRequest(seconds = 60) {
  return {
    config: { timerType: "countdown", countdownSeconds: seconds },
    origin,
  };
}

function intervalRequest() {
  return {
    config: {
      timerType: "interval",
      prepareSeconds: 10,
      workSeconds: 20,
      restSeconds: 10,
      cycles: 3,
      sets: 1,
      restBetweenSetsSeconds: 0,
    },
    origin,
  };
}

function clock() {
  let value = 0;
  return {
    now: () => value,
    set: (next: number) => {
      value = next;
    },
  };
}

function controllerFor(
  platform: ReturnType<typeof createFakePlatformServices>,
  userId: string,
  time: ReturnType<typeof clock>,
  contextId = "tab-a",
) {
  return createTimerController({
    userId,
    contextId,
    lifecycle: platform.lifecycle,
    timerStorage: platform.timerStorage,
    audio: platform.audio,
    clock: time,
  });
}

describe("timer controller persistence", () => {
  it("persists Start and each crossed transition", async () => {
    const platform = createFakePlatformServices();
    const time = clock();
    const controller = controllerFor(platform, "user-a", time);
    await controller.ready;

    expect(await controller.start(intervalRequest())).toMatchObject({
      ok: true,
    });
    const afterStart = await platform.timerStorage.get("user-a", "tab-a");
    expect(afterStart).not.toBeNull();

    time.set(10_000);
    const update = await controller.tick();
    expect(update.transitions).toHaveLength(1);
    const afterTransition = await platform.timerStorage.get("user-a", "tab-a");
    expect(afterTransition?.updatedAt).toBe(10_000);

    controller.dispose();
  });

  it("reconciles a long suspension on resume and emits one signal", async () => {
    const platform = createFakePlatformServices();
    const time = clock();
    const controller = controllerFor(platform, "user-a", time);
    await controller.ready;
    await controller.start(countdownRequest());

    await platform.emitLifecycle("background");
    time.set(60_000);
    expect(controller.getSnapshot().timer.status).toBe("running");

    await platform.emitLifecycle("resume");
    expect(controller.getSnapshot()).toMatchObject({
      timer: { status: "done" },
      lifecycle: "active",
      signal: { kind: "done" },
    });
    expect(platform.playedAudio).toEqual(["done"]);

    controller.dispose();
  });

  it("restores the same user's running snapshot after controller restart", async () => {
    const platform = createFakePlatformServices();
    const firstClock = clock();
    const first = controllerFor(platform, "user-a", firstClock);
    await first.ready;
    await first.start(countdownRequest());
    first.dispose();

    const secondClock = clock();
    secondClock.set(30_000);
    const second = controllerFor(platform, "user-a", secondClock);
    const restored = await second.ready;

    expect(restored).toMatchObject({ status: "restored" });
    expect(second.getSnapshot().timer).toMatchObject({
      status: "running",
      remainingSeconds: 30,
    });
    second.dispose();
  });

  it("restores before accepting a Start issued immediately", async () => {
    const platform = createFakePlatformServices();
    const firstClock = clock();
    const first = controllerFor(platform, "user-a", firstClock);
    await first.ready;
    await first.start(countdownRequest());
    first.dispose();

    const second = controllerFor(platform, "user-a", clock());
    const start = second.start(countdownRequest());

    await expect(start).resolves.toMatchObject({
      ok: false,
      reason: "occupied",
    });
    await expect(second.ready).resolves.toMatchObject({ status: "restored" });
    second.dispose();
  });

  it("does not overwrite a persisted timer after restore storage fails", async () => {
    const platform = createFakePlatformServices();
    const get = vi
      .spyOn(platform.timerStorage, "get")
      .mockRejectedValueOnce(new Error("indexeddb unavailable"));
    const set = vi.spyOn(platform.timerStorage, "set");
    const controller = controllerFor(platform, "user-a", clock());

    await expect(controller.ready).resolves.toMatchObject({
      status: "storage-error",
    });
    await expect(controller.start(countdownRequest())).resolves.toMatchObject({
      ok: false,
      reason: "storage-error",
    });
    expect(set).not.toHaveBeenCalled();

    get.mockRestore();
    await expect(controller.restore()).resolves.toEqual({ status: "empty" });
    await expect(controller.start(countdownRequest())).resolves.toMatchObject({
      ok: true,
    });
    controller.dispose();
  });

  it("does not restore another user's timer", async () => {
    const platform = createFakePlatformServices();
    const firstClock = clock();
    const first = controllerFor(platform, "user-a", firstClock);
    await first.ready;
    await first.start(countdownRequest());
    first.dispose();

    const second = controllerFor(platform, "user-b", clock());
    expect(await second.ready).toEqual({ status: "empty" });
    expect(second.getSnapshot().timer.status).toBe("idle");
    second.dispose();
  });

  it("discards a corrupt snapshot and removes it", async () => {
    const platform = createFakePlatformServices();
    await platform.timerStorage.set({
      version: 1,
      userId: "user-a",
      contextId: "tab-a",
      payload: null,
      updatedAt: 1,
    });

    const controller = controllerFor(platform, "user-a", clock());
    expect(await controller.ready).toEqual({
      status: "discarded",
      reason: "invalid",
    });
    expect(await platform.timerStorage.get("user-a", "tab-a")).toBeNull();
    controller.dispose();
  });

  it("cleans storage on Cancel, Dismiss and logout", async () => {
    const platform = createFakePlatformServices();
    const time = clock();
    const controller = controllerFor(platform, "user-a", time);
    const otherContext = controllerFor(platform, "user-a", clock(), "tab-b");
    await controller.ready;
    await otherContext.ready;

    await controller.start(countdownRequest());
    expect(await controller.cancel()).toBe(true);
    expect(await platform.timerStorage.get("user-a", "tab-a")).toBeNull();

    await controller.start(countdownRequest());
    time.set(60_000);
    await controller.tick();
    expect(controller.getSnapshot().timer.status).toBe("done");
    expect(await controller.dismiss()).toBe(true);
    expect(await platform.timerStorage.get("user-a", "tab-a")).toBeNull();

    await controller.start(countdownRequest());
    await otherContext.start(countdownRequest());
    await controller.logout();
    expect(await platform.timerStorage.get("user-a", "tab-a")).toBeNull();
    expect(await platform.timerStorage.get("user-a", "tab-b")).toBeNull();
    expect(await controller.start(countdownRequest())).toEqual({
      ok: false,
      reason: "logged-out",
    });
    controller.dispose();
    otherContext.dispose();
  });

  it("keeps visual state when audio prepare/play fail", async () => {
    const platform = createFakePlatformServices();
    const time = clock();
    const controller = createTimerController({
      userId: "user-a",
      contextId: "tab-a",
      lifecycle: platform.lifecycle,
      timerStorage: platform.timerStorage,
      audio: {
        prepare: vi.fn().mockRejectedValue(new Error("blocked")),
        play: vi.fn().mockRejectedValue(new Error("blocked")),
      },
      clock: time,
    });
    await controller.ready;
    expect(await controller.start(countdownRequest())).toMatchObject({
      ok: true,
    });
    time.set(60_000);
    await controller.tick();
    expect(controller.getSnapshot()).toMatchObject({
      timer: { status: "done" },
      signal: { kind: "done" },
    });
    controller.dispose();
  });
});
