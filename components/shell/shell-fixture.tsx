"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import type { RoutineMetadata } from "@/lib/contracts";

import { PrivateShell } from "./private-shell";

const FIXTURE_ROUTINES: readonly RoutineMetadata[] = [
  {
    id: "34d9b59a-6cd8-42dc-b8e3-a5ad05d858b0",
    name: "Movimiento",
    icon: "M",
    position: 0,
    recurrenceType: "daily",
    specificDate: null,
  },
  {
    id: "22e60bf2-171f-4851-a42b-fac9cdb04b09",
    name: "Noche",
    icon: "N",
    position: 1,
    recurrenceType: "daily",
    specificDate: null,
  },
  {
    id: "a2a9857e-1071-4834-b25d-f20b20f42d34",
    name: "Plan personal",
    icon: null,
    position: 2,
    recurrenceType: "specific_date",
    specificDate: "2026-09-13",
  },
];

export function ShellFixture({ children }: { readonly children: ReactNode }) {
  const router = useRouter();
  const [routines, setRoutines] =
    useState<readonly RoutineMetadata[]>(FIXTURE_ROUTINES);

  async function createRoutine(name: string): Promise<RoutineMetadata> {
    const createdRoutine: RoutineMetadata = {
      id: crypto.randomUUID(),
      name,
      icon: null,
      position: routines.length,
      recurrenceType: "daily",
      specificDate: null,
    };
    setRoutines((current) => [
      ...current,
      { ...createdRoutine, position: current.length },
    ]);
    return createdRoutine;
  }

  async function reorderRoutines(routineIds: readonly string[]): Promise<void> {
    await Promise.resolve();
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

  async function logout(): Promise<void> {
    await Promise.resolve();
    router.push("/");
  }

  return (
    <PrivateShell
      onCreateRoutine={createRoutine}
      onLogout={logout}
      onReorderRoutines={reorderRoutines}
      routines={routines}
      user={{ displayName: "Espacio de prueba", email: "scaffold@ritmo.local" }}
    >
      {children}
    </PrivateShell>
  );
}
