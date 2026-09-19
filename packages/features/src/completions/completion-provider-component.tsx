import type { ReactNode } from "react";

import { CompletionContext } from "./completion-context";
import type { CompletionStore } from "./completion-store";

export function CompletionProvider({
  children,
  store,
}: {
  readonly children: ReactNode;
  readonly store: CompletionStore;
}) {
  return <CompletionContext value={store}>{children}</CompletionContext>;
}
