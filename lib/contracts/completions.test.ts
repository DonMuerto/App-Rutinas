import { describe, expect, it } from "vitest";

import { completionKeySchema } from "./completions";

const routineId = "6dc5a254-20d1-4a58-bb25-f872847aad1b";

describe("completionKeySchema", () => {
  it("requires an Activity to own its completion scope", () => {
    const result = completionKeySchema.safeParse({
      routineId,
      scopeActivityBlockId: "activity-a",
      blockId: "activity-b",
      blockType: "activity",
      completionDate: "2026-09-13",
    });

    expect(result.success).toBe(false);
  });

  it("allows a checklist target inside its owning Activity", () => {
    expect(
      completionKeySchema.parse({
        routineId,
        scopeActivityBlockId: "activity-a",
        blockId: "checklist-a",
        blockType: "checklist",
        completionDate: "2026-09-13",
      }),
    ).toMatchObject({ blockType: "checklist" });
  });
});
