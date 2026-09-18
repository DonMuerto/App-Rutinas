"use client";

import styles from "./timer.module.css";

import type {
  DoneTimerState,
  RunningTimerState,
  TimerPhaseKind,
  TimerSignal,
} from "@/lib/timer";

const phaseLabels: Record<TimerPhaseKind, string> = {
  prepare: "Preparación",
  work: "Trabajo",
  "cycle-rest": "Descanso de ciclo",
  "set-rest": "Descanso entre sets",
};

export interface TimerDockProps {
  readonly timer: RunningTimerState | DoneTimerState;
  readonly signal: TimerSignal | null;
  readonly onOpen: () => void;
  readonly onFocusRestored: () => void;
  readonly restoreFocus: boolean;
}

export function TimerDock({
  timer,
  signal,
  onOpen,
  onFocusRestored,
  restoreFocus,
}: TimerDockProps) {
  const activityTitle =
    timer.origin.activityTitle.trim() || "Actividad sin título";
  const status =
    timer.status === "done" ? "Finalizado" : phaseLabels[timer.phase.kind];
  const statusPosition =
    timer.status === "running"
      ? [
          timer.phase.cycle === undefined ? null : `ciclo ${timer.phase.cycle}`,
          timer.phase.set === undefined ? null : `set ${timer.phase.set}`,
        ]
          .filter((part) => part !== null)
          .join(", ")
      : "";

  return (
    <aside
      aria-label="Temporizador activo"
      className={styles.dock}
      data-phase={timer.status === "done" ? "done" : timer.phase.kind}
    >
      {signal !== null ? (
        <span aria-hidden="true" className={styles.dockPulse} key={signal.id} />
      ) : null}
      <span aria-live="polite" className={styles.dockStatus}>
        {status}
        {statusPosition ? `, ${statusPosition}` : ""}
      </span>
      <span className={styles.dockTitle}>{activityTitle}</span>
      <button
        autoFocus={restoreFocus}
        className={styles.dockButton}
        data-timer-focus-trigger
        onFocus={onFocusRestored}
        onClick={onOpen}
        type="button"
      >
        Abrir enfoque
      </button>
    </aside>
  );
}
