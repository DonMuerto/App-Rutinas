import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { LiveShell } from "@/components/shell";
import { TimerProvider } from "@/components/timer";
import { QueryProvider } from "@/components/providers/query-provider";
import { logoutAction } from "@/app/(auth)/actions";
import { createServerRepositories } from "@/lib/repositories/server";
import { DomainError } from "@/lib/contracts";
import { requireUser } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

export default async function PrivateLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  const user = await requireUser().catch((error: unknown) => {
    if (error instanceof DomainError && error.code === "UNAUTHENTICATED") {
      redirect("/login");
    }
    throw error;
  });
  const repositories = await createServerRepositories();
  const routines = await repositories.routines.listMetadata();

  return (
    <QueryProvider>
      <TimerProvider>
        <LiveShell
          initialRoutines={routines}
          onLogout={logoutAction}
          user={{ email: user.email ?? undefined }}
        >
          {children}
        </LiveShell>
      </TimerProvider>
    </QueryProvider>
  );
}
