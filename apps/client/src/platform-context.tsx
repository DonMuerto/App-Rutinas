import type { PropsWithChildren } from "react";
import type { PlatformServices } from "@ritmo/platform";

import { PlatformContext } from "./platform-context-value";

export function PlatformProvider({
  children,
  platform,
}: PropsWithChildren<{ platform: PlatformServices }>) {
  return <PlatformContext value={platform}>{children}</PlatformContext>;
}
