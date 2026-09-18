import { describe, expect, it } from "vitest";

import type { CompletionKey, Routine } from "@/lib/contracts";

import {
  projectActivities,
  sortProjectedActivities,
} from "./project-activities";

const routineId = "22222222-2222-4222-8222-222222222222";

function routine(content: unknown): Routine {
  return {
    id: routineId,
    name: "Noche",
    icon: null,
    position: 2,
    recurrenceType: "daily",
    specificDate: null,
    content: content as Routine["content"],
  };
}

const activityProps = {
  schemaVersion: 1,
  scheduledTime: "21:00",
  timerType: "countdown",
  countdownSeconds: 1_800,
  prepareSeconds: 10,
  workSeconds: 20,
  restSeconds: 10,
  cycles: 8,
  sets: 1,
  restBetweenSetsSeconds: 60,
};

describe("activity projection", () => {
  it("uses nearest Activity scope and preserves relative depth and DFS order", () => {
    const completion: CompletionKey = {
      routineId,
      scopeActivityBlockId: "activity-a",
      blockId: "deep-check",
      blockType: "checklist",
      completionDate: "2026-09-13",
    };
    const result = projectActivities({
      routine: routine([
        {
          id: "activity-a",
          type: "activity",
          props: activityProps,
          content: [
            { type: "text", text: "Leer ", styles: {} },
            {
              type: "link",
              href: "https://example.com",
              content: [{ type: "text", text: "libro", styles: {} }],
            },
          ],
          children: [
            {
              id: "paragraph-a",
              type: "paragraph",
              props: {},
              content: [],
              children: [
                {
                  id: "deep-check",
                  type: "checkListItem",
                  props: { checked: true },
                  content: [{ type: "text", text: "Preparar", styles: {} }],
                  children: [],
                },
              ],
            },
            {
              id: "activity-b",
              type: "activity",
              props: { ...activityProps, timerType: "none" },
              content: "Respirar",
              children: [
                {
                  id: "nested-check",
                  type: "checkListItem",
                  props: { checked: true },
                  content: "Sentarse",
                  children: [],
                },
              ],
            },
          ],
        },
      ]),
      completionDate: "2026-09-13",
      completions: [completion],
    });

    expect(result.activities).toHaveLength(2);
    expect(result.activities[0]).toMatchObject({
      activityBlockId: "activity-a",
      title: "Leer libro",
      documentOrder: 0,
      subtasks: [
        {
          blockId: "deep-check",
          title: "Preparar",
          relativeDepth: 2,
          completed: true,
        },
      ],
    });
    expect(result.activities[1]).toMatchObject({
      activityBlockId: "activity-b",
      documentOrder: 1,
      subtasks: [
        {
          blockId: "nested-check",
          relativeDepth: 1,
          completed: false,
        },
      ],
    });
  });

  it("keeps an invalid Activity visible and disables its timer", () => {
    const result = projectActivities({
      routine: routine([
        {
          type: "activity",
          props: {
            schemaVersion: 9,
            scheduledTime: "25:00",
            timerType: "countdown",
            countdownSeconds: 3,
          },
          content: [],
        },
      ]),
      completionDate: "2026-09-13",
    });

    expect(result.activities[0]).toMatchObject({
      activityBlockId: undefined,
      scheduledTime: undefined,
      timer: { status: "invalid" },
      canComplete: false,
    });
    expect(result.diagnostics.map(({ code }) => code)).toEqual([
      "ACTIVITY_SCHEMA_VERSION_INVALID",
      "ACTIVITY_SCHEDULED_TIME_INVALID",
      "ACTIVITY_TIMER_INVALID",
      "ACTIVITY_ID_MISSING",
    ]);
  });

  it("does not expose a valid timer for an unsupported Activity version", () => {
    const result = projectActivities({
      routine: routine([
        {
          id: "future-activity",
          type: "activity",
          props: { ...activityProps, schemaVersion: 2 },
          content: "Future",
          children: [],
        },
      ]),
      completionDate: "2026-09-13",
    });

    expect(result.activities[0]?.timer).toEqual({ status: "invalid" });
    expect(result.diagnostics.map(({ code }) => code)).toEqual([
      "ACTIVITY_SCHEMA_VERSION_INVALID",
      "ACTIVITY_TIMER_INVALID",
    ]);
  });

  it("reports malformed document structure without throwing", () => {
    const result = projectActivities({
      routine: routine([null, { type: "future", children: "broken" }]),
      completionDate: "2026-09-13",
    });

    expect(result.activities).toEqual([]);
    expect(result.diagnostics.map(({ code }) => code)).toEqual([
      "BLOCK_INVALID",
      "BLOCK_TYPE_INVALID",
      "BLOCK_CHILDREN_INVALID",
    ]);
  });

  it("does not expose completion or origin links for duplicate IDs", () => {
    const result = projectActivities({
      routine: routine([
        {
          id: "duplicate",
          type: "activity",
          props: activityProps,
          content: "First",
        },
        {
          id: "duplicate",
          type: "activity",
          props: activityProps,
          content: "Second",
        },
      ]),
      completionDate: "2026-09-13",
    });

    expect(result.activities).toHaveLength(2);
    expect(result.activities.every((activity) => !activity.canComplete)).toBe(
      true,
    );
    expect(result.activities.every((activity) => !activity.origin)).toBe(true);
    expect(result.diagnostics.map(({ code }) => code)).toEqual([
      "BLOCK_ID_DUPLICATE",
      "BLOCK_ID_DUPLICATE",
    ]);
  });

  it("sorts without mutating by time, routine position, document and IDs", () => {
    const base = projectActivities({
      routine: routine([
        { id: "late", type: "activity", props: activityProps, content: "Late" },
        {
          id: "none",
          type: "activity",
          props: { ...activityProps, scheduledTime: "" },
          content: "None",
        },
      ]),
      completionDate: "2026-09-13",
    }).activities;
    const original = [...base];
    const sorted = sortProjectedActivities(base);

    expect(sorted.map(({ activityBlockId }) => activityBlockId)).toEqual([
      "late",
      "none",
    ]);
    expect(base).toEqual(original);
  });
});
