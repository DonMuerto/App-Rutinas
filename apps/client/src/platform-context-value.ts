import { createContext } from "react";
import type { PlatformServices } from "@ritmo/platform";

export const PlatformContext = createContext<PlatformServices | null>(null);
