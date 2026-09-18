import { notFound } from "next/navigation";

import { RoutineEditorScreen } from "@/components/editor";
import { DomainError } from "@/lib/contracts";
import { createServerRepositories } from "@/lib/repositories/server";

async function loadRoutine(routineId: string) {
  const repositories = await createServerRepositories();

  try {
    return await repositories.routines.getById(routineId);
  } catch (error) {
    if (
      error instanceof DomainError &&
      (error.code === "NOT_FOUND" || error.code === "VALIDATION")
    ) {
      notFound();
    }
    throw error;
  }
}

export default async function RoutinePage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ routineId: string }>;
  readonly searchParams: Promise<{ activity?: string | string[] }>;
}) {
  const [{ routineId }, query] = await Promise.all([params, searchParams]);
  const routine = await loadRoutine(routineId);
  const requestedBlockId = Array.isArray(query.activity)
    ? query.activity[0]
    : query.activity;

  return (
    <RoutineEditorScreen
      initialRoutine={routine}
      requestedBlockId={requestedBlockId}
    />
  );
}
