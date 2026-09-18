"use client";

import { useState, type ReactNode } from "react";

import type { Routine, RoutineMetadata } from "@/lib/contracts";
import { createBrowserRepositories } from "@/lib/repositories/browser";

import { PrivateShell } from "./private-shell";

export interface LiveShellProps {
  readonly children: ReactNode;
  readonly initialRoutines: readonly RoutineMetadata[];
  readonly onLogout: () => Promise<void>;
  readonly user?: {
    readonly email?: string;
  };
}

function metadataFromRoutine(
  routine: Routine,
  position: number,
): RoutineMetadata {
  const recurrence =
    routine.recurrenceType === "daily"
      ? { recurrenceType: "daily" as const, specificDate: null }
      : {
          recurrenceType: "specific_date" as const,
          specificDate: routine.specificDate,
        };

  return {
    id: routine.id,
    name: routine.name,
    icon: routine.icon,
    position,
    ...recurrence,
  };
}

export function LiveShell({
  children,
  initialRoutines,
  onLogout,
  user,
}: LiveShellProps) {
  const [routines, setRoutines] =
    useState<readonly RoutineMetadata[]>(initialRoutines);

  async function createRoutine(name: string): Promise<RoutineMetadata> {
    const repositories = await createBrowserRepositories();
    const routine = await repositories.routines.create({
      name,
      recurrenceType: "daily",
      specificDate: null,
    });
    const createdMetadata = metadataFromRoutine(routine, routines.length);

    setRoutines((current) => [
      ...current,
      { ...createdMetadata, position: current.length },
    ]);
    return createdMetadata;
  }

  async function reorderRoutines(routineIds: readonly string[]): Promise<void> {
    const repositories = await createBrowserRepositories();
    await repositories.routines.reorder([...routineIds]);

    setRoutines((current) => {
      const routinesById = new Map(
        current.map((routine) => [routine.id, routine]),
      );
      return routineIds.flatMap((routineId, position) => {
        const routine = routinesById.get(routineId);
        return routine ? [{ ...routine, position }] : [];
      });
    });
  }

  return (
    <PrivateShell
      onCreateRoutine={createRoutine}
      onLogout={onLogout}
      onReorderRoutines={reorderRoutines}
      routines={routines}
      user={user}
    >
      {children}
    </PrivateShell>
  );
}
