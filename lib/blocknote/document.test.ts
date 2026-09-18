import { describe, expect, it } from "vitest";

import type { RitmoBlock } from "./activity-block-spec";
import {
  getStableBlockIds,
  inspectDocument,
  normalizeActivityChecklists,
} from "./document";

describe("document adapter", () => {
  it("adapts an empty persisted document without rewriting it", () => {
    const result = inspectDocument([]);

    expect(result.kind).toBe("editable");
    if (result.kind !== "editable") return;
    expect(result.original).toEqual([]);
    expect(result.syntheticEmptyBlock).toBe(true);
    expect(result.initialContent).toEqual([{ type: "paragraph" }]);
  });

  it("enters read-only recovery for unknown blocks without changing JSON", () => {
    const document = [
      { id: "legacy", type: "futureBlock", props: {}, content: [] },
    ];
    const result = inspectDocument(document);

    expect(result.kind).toBe("recovery");
    expect(result.original).toBe(document);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "UNKNOWN_BLOCK_TYPE" }),
      ]),
    );
  });

  it("allows invalid primitive Activity values so the user can fix them", () => {
    const result = inspectDocument([
      {
        id: "activity-a",
        type: "activity",
        props: {
          schemaVersion: 1,
          scheduledTime: "99:99",
          timerType: "countdown",
          countdownSeconds: 10,
        },
        content: [],
        children: [],
      },
    ]);

    expect(result.kind).toBe("editable");
  });

  it("marks duplicate IDs as ambiguous without preventing recovery editing", () => {
    const result = inspectDocument([
      { id: "same", type: "paragraph", props: {}, content: [] },
      { id: "same", type: "paragraph", props: {}, content: [] },
    ]);

    expect(result.kind).toBe("editable");
    if (result.kind !== "editable") return;
    expect(result.ambiguousBlockIds.has("same")).toBe(true);
    expect(result.stableBlockIds.has("same")).toBe(false);
    expect(result.initialContent.every((block) => block.id === undefined)).toBe(
      true,
    );
  });

  it("mounts a safe copy when a stored block ID is malformed", () => {
    const document = [
      { id: 42, type: "paragraph", props: {}, content: [], children: [] },
    ];
    const result = inspectDocument(document);

    expect(result.kind).toBe("editable");
    if (result.kind !== "editable") return;
    expect(result.original).toEqual(document);
    expect(result.initialContent[0]?.id).toBeUndefined();
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "BLOCK_ID_MISSING" }),
      ]),
    );
  });

  it("rejects native prop values that BlockNote cannot preserve", () => {
    const result = inspectDocument([
      {
        id: "heading-a",
        type: "heading",
        props: { level: 9, textAlignment: "diagonal" },
        content: [],
      },
    ]);

    expect(result.kind).toBe("recovery");
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "BLOCK_PROP_UNSUPPORTED" }),
      ]),
    );
  });

  it("normalizes only checklists under Activity and does not mutate input", () => {
    const document = [
      {
        id: "normal",
        type: "checkListItem",
        props: {
          backgroundColor: "default",
          textColor: "default",
          textAlignment: "left",
          checked: true,
        },
        content: [],
        children: [],
      },
      {
        id: "activity-a",
        type: "activity",
        props: {
          schemaVersion: 1,
          scheduledTime: "",
          timerType: "none",
          countdownSeconds: 1_800,
          prepareSeconds: 10,
          workSeconds: 20,
          restSeconds: 10,
          cycles: 8,
          sets: 1,
          restBetweenSetsSeconds: 60,
        },
        content: [],
        children: [
          {
            id: "daily",
            type: "checkListItem",
            props: {
              backgroundColor: "default",
              textColor: "default",
              textAlignment: "left",
              checked: true,
            },
            content: [],
            children: [],
          },
        ],
      },
    ] as unknown as RitmoBlock[];

    const normalized = normalizeActivityChecklists(document);

    const normalBefore = document[0];
    const activityBefore = document[1];
    const normalAfter = normalized[0];
    const activityAfter = normalized[1];
    if (
      normalBefore?.type !== "checkListItem" ||
      activityBefore?.type !== "activity" ||
      activityBefore.children[0]?.type !== "checkListItem" ||
      normalAfter?.type !== "checkListItem" ||
      activityAfter?.type !== "activity" ||
      activityAfter.children[0]?.type !== "checkListItem"
    ) {
      throw new Error("Fixture de checklist invalido.");
    }

    expect(normalBefore.props.checked).toBe(true);
    expect(activityBefore.children[0].props.checked).toBe(true);
    expect(normalAfter.props.checked).toBe(true);
    expect(activityAfter.children[0].props.checked).toBe(false);
    expect(normalized).not.toBe(document);
  });

  it("recomputes stable IDs for newly inserted blocks", () => {
    const blocks = [
      { id: "first", type: "paragraph", children: [] },
      { id: "inserted", type: "activity", children: [] },
    ] as unknown as RitmoBlock[];

    expect([...getStableBlockIds(blocks)]).toEqual(["first", "inserted"]);
  });
});
