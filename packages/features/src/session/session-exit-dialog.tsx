import { Button, Dialog } from "@ritmo/ui";

import type { DraftExitState, SessionExitDecision } from "../contracts";

export function SessionExitDialog({
  onDecision,
  open,
  state,
}: {
  readonly onDecision: (decision: SessionExitDecision) => void;
  readonly open: boolean;
  readonly state: DraftExitState;
}) {
  return (
    <Dialog
      descriptionId="session-exit-description"
      labelId="session-exit-title"
      onClose={() => onDecision("cancel")}
      open={open}
    >
      <h2 className="feature-dialog-title" id="session-exit-title">
        Hay cambios sin sincronizar
      </h2>
      <p className="feature-dialog-copy" id="session-exit-description">
        {state.pendingCount === 1
          ? "Una rutina conserva un borrador local."
          : `${state.pendingCount} rutinas conservan borradores locales.`}{" "}
        Decide que hacer antes de cerrar la sesion.
      </p>
      <div className="feature-dialog-actions">
        {state.canSync ? (
          <Button onClick={() => onDecision("sync")} variant="primary">
            Sincronizar y salir
          </Button>
        ) : null}
        <Button onClick={() => onDecision("save-copy")} variant="secondary">
          Guardar copia local
        </Button>
        <Button onClick={() => onDecision("discard")} variant="danger">
          Descartar cambios
        </Button>
        <Button onClick={() => onDecision("cancel")} variant="quiet">
          Cancelar
        </Button>
      </div>
    </Dialog>
  );
}
