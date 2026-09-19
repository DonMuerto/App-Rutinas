import { describe, expect, it } from "vitest";

import type { DocumentBlock } from "./types";
import {
  createEmptyDocument,
  getActivityDurationSeconds,
  inspectActivityProps,
  inspectDocument,
  migrateDocumentEnvelope,
  normalizeActivityChecklists,
  projectActivities,
  serializeDocument,
  sortProjectedActivities,
} from "./index";

const routineId = "6dc5a254-20d1-4a58-bb25-f872847aad1b";
const activityProps = {
  schemaVersion: 1,
  timerType: "countdown",
  countdownSeconds: 1_800,
  prepareSeconds: 10,
  workSeconds: 20,
  restSeconds: 10,
  cycles: 8,
  sets: 1,
  restBetweenSetsSeconds: 60,
};

describe("document envelope", () => {
  it("migrates a legacy array once without changing its blocks", () => {
    const legacy = [{ id: "a", type: "paragraph", props: {}, content: [] }];
    const first = migrateDocumentEnvelope(legacy);
    expect(first).toMatchObject({
      kind: "ready",
      migratedFromLegacyArray: true,
      document: { schemaVersion: 1, blocks: legacy },
    });
    if (first.kind !== "ready") return;
    expect(migrateDocumentEnvelope(first.document)).toMatchObject({
      kind: "ready",
      migratedFromLegacyArray: false,
      document: first.document,
    });
  });

  it("rejects unsupported versions without rewriting the original", () => {
    const future = { schemaVersion: 2, blocks: [] };
    const result = migrateDocumentEnvelope(future);
    expect(result).toMatchObject({ kind: "recovery", original: future });
  });

  it("creates the canonical empty envelope", () => {
    expect(createEmptyDocument()).toEqual({ schemaVersion: 1, blocks: [] });
  });
});

describe("document inspection and persistence", () => {
  it("opens an empty document with a synthetic paragraph", () => {
    const result = inspectDocument(createEmptyDocument());
    expect(result).toMatchObject({
      kind: "editable",
      syntheticEmptyBlock: true,
      initialBlocks: [{ type: "paragraph" }],
    });
  });

  it("preserves invalid Activity values for contextual correction", () => {
    const result = inspectDocument({
      schemaVersion: 1,
      blocks: [
        {
          id: "activity-a",
          type: "activity",
          props: {
            ...activityProps,
            schemaVersion: 9,
            scheduledTime: "25:00",
            countdownSeconds: 3,
          },
          content: [],
          children: [],
        },
      ],
    });
    expect(result.kind).toBe("editable");
  });

  it("keeps unknown blocks in read-only recovery", () => {
    const source = {
      schemaVersion: 1,
      blocks: [{ id: "future", type: "futureBlock", props: {} }],
    };
    const result = inspectDocument(source);
    expect(result).toMatchObject({ kind: "recovery", original: source });
  });

  it("normalizes only Activity checklists and the time adapter sentinel", () => {
    const blocks: DocumentBlock[] = [
      {
        id: "normal",
        type: "checkListItem",
        props: { checked: true },
        content: [],
        children: [],
      },
      {
        id: "activity-a",
        type: "activity",
        props: { ...activityProps, scheduledTime: "" },
        content: [],
        children: [
          {
            id: "daily",
            type: "checkListItem",
            props: { checked: true },
            content: [],
            children: [],
          },
        ],
      },
    ];
    const serialized = serializeDocument(blocks);
    const normal = serialized.blocks[0] as { props: { checked: boolean } };
    const activity = serialized.blocks[1] as {
      props: Record<string, unknown>;
      children: Array<{ props: { checked: boolean } }>;
    };

    expect(normal.props.checked).toBe(true);
    expect(activity.children[0]?.props.checked).toBe(false);
    expect(activity.props).not.toHaveProperty("scheduledTime");
    expect(blocks[1]?.props.scheduledTime).toBe("");
  });

  it("normalizes persisted JSON without dropping unknown or invalid values", () => {
    const source = {
      schemaVersion: 1 as const,
      blocks: [
        {
          id: "activity-a",
          type: "activity",
          props: {
            ...activityProps,
            scheduledTime: "",
            futureProp: "preserve-me",
          },
          content: [],
          children: [
            {
              id: "daily",
              type: "checkListItem",
              props: { checked: true, futureProp: 42 },
            },
          ],
        },
      ],
    };

    const normalized = normalizeActivityChecklists(source);
    const activity = normalized.blocks[0] as {
      props: Record<string, unknown>;
      children: Array<{ props: Record<string, unknown> }>;
    };
    expect(activity.props).toMatchObject({ futureProp: "preserve-me" });
    expect(activity.props).not.toHaveProperty("scheduledTime");
    expect(activity.children[0]?.props).toEqual({
      checked: false,
      futureProp: 42,
    });
    expect(source.blocks[0]?.props.scheduledTime).toBe("");
  });
});

describe("Activity model and projection", () => {
  it("validates active timer fields and excludes final rests", () => {
    const inspected = inspectActivityProps({
      schemaVersion: 1,
      timerType: "interval",
      prepareSeconds: 10,
      workSeconds: 20,
      restSeconds: 10,
      cycles: 3,
      sets: 2,
      restBetweenSetsSeconds: 60,
    });
    expect(getActivityDurationSeconds(inspected.timer)).toBe(230);
  });

  it("uses nearest Activity scope and external completion", () => {
    const result = projectActivities({
      routine: {
        id: routineId,
        name: "Noche",
        icon: null,
        position: 1,
        recurrenceType: "daily",
        specificDate: null,
        content: {
          schemaVersion: 1,
          blocks: [
            {
              id: "activity-a",
              type: "activity",
              props: { ...activityProps, scheduledTime: "21:00" },
              content: "Leer",
              children: [
                {
                  id: "paragraph-a",
                  type: "paragraph",
                  props: {},
                  content: [],
                  children: [
                    {
                      id: "check-a",
                      type: "checkListItem",
                      props: { checked: true },
                      content: "Preparar",
                      children: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      completionDate: "2026-09-18",
      completions: [
        {
          routineId,
          scopeActivityBlockId: "activity-a",
          blockId: "check-a",
          blockType: "checklist",
          completionDate: "2026-09-18",
        },
      ],
    });

    expect(result.activities[0]).toMatchObject({
      title: "Leer",
      scheduledTime: "21:00",
      subtasks: [{ title: "Preparar", relativeDepth: 2, completed: true }],
    });
  });

  it("sorts a copy by time and stable tie breakers", () => {
    const projected = projectActivities({
      routine: {
        id: routineId,
        name: "Noche",
        icon: null,
        position: 1,
        recurrenceType: "daily",
        specificDate: null,
        content: {
          schemaVersion: 1,
          blocks: [
            {
              id: "none",
              type: "activity",
              props: activityProps,
              content: "Sin hora",
            },
            {
              id: "early",
              type: "activity",
              props: { ...activityProps, scheduledTime: "07:00" },
              content: "Temprano",
            },
          ],
        },
      },
      completionDate: "2026-09-18",
    }).activities;
    const original = [...projected];
    expect(
      sortProjectedActivities(projected).map((item) => item.activityBlockId),
    ).toEqual(["early", "none"]);
    expect(projected).toEqual(original);
  });
});
