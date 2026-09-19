/* eslint-disable react-refresh/only-export-components -- Runtime context and hook form one application boundary. */
import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { AuthSnapshot, DataAuthServices } from "@ritmo/data-auth";
import type { PlatformServices } from "@ritmo/platform";

export type DataAuthResult =
  | { readonly status: "ready"; readonly services: DataAuthServices }
  | { readonly status: "configuration-error"; readonly error: Error };

interface ClientRuntimeValue {
  readonly auth: AuthSnapshot;
  readonly data: DataAuthResult;
  readonly platform: PlatformServices;
}

const RuntimeContext = createContext<ClientRuntimeValue | null>(null);

const CONFIGURATION_ERROR_AUTH: AuthSnapshot = Object.freeze({
  status: "network-error",
  user: null,
});

export function RuntimeProvider({
  children,
  data,
  platform,
}: {
  readonly children: ReactNode;
  readonly data: DataAuthResult;
  readonly platform: PlatformServices;
}) {
  const authService = data.status === "ready" ? data.services.auth : null;
  const auth = useSyncExternalStore(
    (listener) => authService?.subscribe(() => listener()) ?? (() => undefined),
    () => authService?.getSnapshot() ?? CONFIGURATION_ERROR_AUTH,
    () => authService?.getSnapshot() ?? CONFIGURATION_ERROR_AUTH,
  );

  useEffect(() => {
    if (!authService) return;
    void authService.initialize().catch(() => undefined);
    return platform.lifecycle.subscribe((event) => {
      if (event === "resume") void authService.refresh().catch(() => undefined);
    });
  }, [authService, platform.lifecycle]);

  return (
    <RuntimeContext value={{ auth, data, platform }}>{children}</RuntimeContext>
  );
}

export function useRuntime() {
  const runtime = useContext(RuntimeContext);
  if (!runtime) throw new Error("useRuntime requires RuntimeProvider.");
  return runtime;
}
