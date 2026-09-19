import { use } from "react";

import { PlatformContext } from "./platform-context-value";

export function usePlatform() {
  const platform = use(PlatformContext);
  if (!platform) {
    throw new Error("usePlatform must be used within PlatformProvider.");
  }
  return platform;
}
