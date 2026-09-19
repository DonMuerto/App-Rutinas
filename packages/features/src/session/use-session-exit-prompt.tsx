import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type {
  DraftExitState,
  SessionExitDecision,
  SessionExitDecisionPrompt,
} from "../contracts";
import { SessionExitDialog } from "./session-exit-dialog";

interface PendingDecision {
  readonly state: DraftExitState;
  readonly resolve: (decision: SessionExitDecision) => void;
}

export function useSessionExitPrompt(): {
  readonly cancel: () => void;
  readonly dialog: ReactNode;
  readonly isOpen: boolean;
  readonly requestDecision: SessionExitDecisionPrompt;
} {
  const [pending, setPending] = useState<PendingDecision | null>(null);
  const activeRequest = useRef<PendingDecision | null>(null);

  useEffect(
    () => () => {
      activeRequest.current?.resolve("cancel");
      activeRequest.current = null;
    },
    [],
  );

  const requestDecision = useCallback(
    (state: DraftExitState) =>
      new Promise<SessionExitDecision>((resolve) => {
        const request = { state, resolve };
        activeRequest.current?.resolve("cancel");
        activeRequest.current = request;
        setPending(request);
      }),
    [],
  );

  const decide = useCallback((decision: SessionExitDecision) => {
    const request = activeRequest.current;
    activeRequest.current = null;
    setPending(null);
    request?.resolve(decision);
  }, []);
  const cancel = useCallback(() => decide("cancel"), [decide]);

  return {
    cancel,
    isOpen: pending !== null,
    requestDecision,
    dialog: (
      <SessionExitDialog
        onDecision={decide}
        open={pending !== null}
        state={pending?.state ?? { pendingCount: 0, canSync: false }}
      />
    ),
  };
}
