import { describe, expect, it } from "vitest";

import type { TodayActivity } from "./types";
import { sortTodayActivities } from "./order";

function activity(
  activityBlockId: string,
  overrides: Partial<TodayActivity> = {},
): TodayActivity {
  const routineId =
    overrides.routineId ?? "6dc5a254-20d1-4a58-bb25-f872847aad1b";

  return {
    routineId,
    routineName: "Rutina",
    routineIcon: null,
    routinePosition: 0,
    activityBlockId,
    title: activityBlockId,
    scheduledTime: undefined,
    documentOrder: 0,
    timer: { status: "none" },
    completed: false,
    canComplete: true,
    timerActive: false,
    subtasks: [],
    origin: { routineId, activityBlockId },
    diagnostics: [],
    ...overrides,
  };
}

describe("sortTodayActivities", () => {
  it("sorts valid times first and unscheduled activities last", () => {
    const result = sortTodayActivities([
      activity("none", { scheduledTime: undefined }),
      activity("late", { scheduledTime: "21:00" }),
      activity("early", { scheduledTime: "07:30" }),
    ]);

    expect(result.map(({ activityBlockId }) => activityBlockId)).toEqual([
      "early",
      "late",
      "none",
    ]);
  });

  it("uses routine position, document order and IDs as stable tie breakers", () => {
    const result = sortTodayActivities([
      activity("block-b", { scheduledTime: "08:00", documentOrder: 2 }),
      activity("block-c", {
        scheduledTime: "08:00",
        routinePosition: 1,
      }),
      activity("block-a", { scheduledTime: "08:00", documentOrder: 2 }),
      activity("first", { scheduledTime: "08:00", documentOrder: 1 }),
    ]);

    expect(result.map(({ activityBlockId }) => activityBlockId)).toEqual([
      "first",
      "block-a",
      "block-b",
      "block-c",
    ]);
  });

  it("does not mutate the projection supplied by S2", () => {
    const input = [activity("second", { documentOrder: 2 }), activity("first")];

    sortTodayActivities(input);

    expect(input.map(({ activityBlockId }) => activityBlockId)).toEqual([
      "second",
      "first",
    ]);
  });
});
