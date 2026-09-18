import { describe, expect, it, vi } from "vitest";

import type { CompletionRepository } from "@/lib/repositories";

import {
  RepositoryTodayDataSource,
  type TodayRepositories,
} from "./repository-source";

const routineId = "6dc5a254-20d1-4a58-bb25-f872847aad1b";

function createRepositories(): TodayRepositories {
  const completions: CompletionRepository = {
    list: vi.fn().mockResolvedValue([
      {
        id: "b12e9993-61bb-40ed-9be4-dcb74f8a1c81",
        routineId,
        scopeActivityBlockId: "activity-a",
        blockId: "activity-a",
        blockType: "activity",
        completionDate: "2026-09-13",
        completedAt: "2026-09-13T12:00:00Z",
      },
    ]),
    mark: vi.fn(),
    unmark: vi.fn(),
  };

  return {
    routines: {
      listForDate: vi.fn().mockResolvedValue([
        {
          id: routineId,
          name: "Noche",
          icon: null,
          position: 0,
          recurrenceType: "daily",
          specificDate: null,
          content: [
            {
              id: "activity-a",
              type: "activity",
              props: {
                schemaVersion: 1,
                scheduledTime: "21:00",
                timerType: "none",
              },
              content: [{ type: "text", text: "Lectura", styles: {} }],
              children: [],
            },
          ],
        },
      ]),
    },
    completions,
  };
}

describe("RepositoryTodayDataSource", () => {
  it("loads eligible routines and same-date completions before projecting", async () => {
    const repositories = createRepositories();
    const source = new RepositoryTodayDataSource(repositories);

    const model = await source.load("2026-09-13", new AbortController().signal);

    expect(repositories.routines.listForDate).toHaveBeenCalledWith(
      "2026-09-13",
    );
    expect(repositories.completions.list).toHaveBeenCalledWith(
      [routineId],
      "2026-09-13",
    );
    expect(model.activities).toHaveLength(1);
    expect(model.activities[0]).toMatchObject({
      title: "Lectura",
      scheduledTime: "21:00",
      completed: true,
    });
  });

  it("does not continue into completions after an aborted routine request", async () => {
    const repositories = createRepositories();
    const source = new RepositoryTodayDataSource(repositories);
    const controller = new AbortController();
    controller.abort();

    await expect(
      source.load("2026-09-13", controller.signal),
    ).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(repositories.completions.list).not.toHaveBeenCalled();
  });
});
