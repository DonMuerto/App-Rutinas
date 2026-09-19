import { createContext } from "react";

import type { CompletionStore } from "./completion-store";

export const CompletionContext = createContext<CompletionStore | null>(null);
