"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";

import styles from "./timer.module.css";

import type {
  DoneTimerState,
  RunningTimerState,
  TimerPhaseKind,
  TimerSignal,
} from "@/lib/timer";

import { TimerRing } from "./timer-ring";

const phaseLabels: Record<TimerPhaseKind | "done", string> = {
  prepare: "Preparación",
  work: "Trabajo",
  "cycle-rest": "Descanso de ciclo",
  "set-rest": "Descanso entre sets",
  done: "Finalizado",
};

export interface TimerOverlayProps {
  readonly timer: RunningTimerState | DoneTimerState;
  readonly signal: TimerSignal | null;
  readonly onCancel: () => void;
  readonly onClose: () => void;
  readonly onDismiss: () => void;
}

function formatRemaining(seconds: number): string {
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainingSeconds = seconds % 60;
  const minuteSecond = `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;

  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${minuteSecond}`
    : minuteSecond;
}

function announceSignal(signal: TimerSignal | null): string {
  if (signal === null) {
    return "";
  }

  if (signal.kind === "done") {
    return "Temporizador finalizado";
  }

  const phase =
    signal.transition.type === "phase-changed" ? signal.transition.to : null;
  const position = [
    phase?.cycle === undefined ? null : `ciclo ${phase.cycle}`,
    phase?.set === undefined ? null : `set ${phase.set}`,
  ]
    .filter((part) => part !== null)
    .join(", ");

  return `Fase: ${phaseLabels[signal.kind]}${position ? `. ${position}` : ""}`;
}

export function TimerOverlay({
  timer,
  signal,
  onCancel,
  onClose,
  onDismiss,
}: TimerOverlayProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const firstControl = dialogRef.current?.querySelector<HTMLElement>(
      "button:not([disabled])",
    );
    firstControl?.focus();

    return () => {
      if (
        previouslyFocused instanceof HTMLElement &&
        previouslyFocused.isConnected
      ) {
        previouslyFocused.focus();
      } else {
        document
          .querySelector<HTMLElement>("[data-timer-focus-trigger]")
          ?.focus();
      }
    };
  }, []);

  function containFocus(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const controls = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );

    if (controls.length === 0) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }

    const first = controls[0];
    const last = controls.at(-1)!;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const done = timer.status === "done";
  const phase = done ? "done" : timer.phase.kind;
  const title = timer.origin.activityTitle.trim() || "Actividad sin título";
  const remaining = done ? 0 : timer.remainingSeconds;
  const progress = done ? 1 : timer.progress;
  const intervalPosition =
    !done && timer.mode === "interval"
      ? timer.phase.kind === "prepare"
        ? `Preparación / Set 1 de ${timer.plan.sets}`
        : timer.phase.kind === "set-rest"
          ? `Entre sets ${timer.phase.set ?? 1} y ${(timer.phase.set ?? 1) + 1}`
          : `Ciclo ${timer.phase.cycle} de ${timer.plan.cycles} / Set ${timer.phase.set} de ${timer.plan.sets}`
      : null;

  return (
    <div className={styles.backdrop}>
      <div
        aria-labelledby="timer-focus-title"
        aria-modal="true"
        className={styles.dialog}
        data-phase={phase}
        data-transition-signal={signal?.kind}
        onKeyDown={containFocus}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <button
          aria-label="Cerrar modo enfoque"
          className={styles.closeButton}
          onClick={onClose}
          type="button"
        >
          <span aria-hidden="true">×</span>
        </button>

        {signal !== null ? (
          <div className={styles.signalFlare} key={signal.id} />
        ) : null}

        <header className={styles.header}>
          <p className={styles.routine}>{timer.origin.routineName}</p>
          <h2 className={styles.title} id="timer-focus-title">
            {title}
          </h2>
        </header>

        <div className={styles.timerFace}>
          <TimerRing phase={phase} progress={progress} />
          <div className={styles.timerText}>
            <p className={styles.phase}>{phaseLabels[phase]}</p>
            <p
              aria-label={`${remaining} segundos restantes`}
              className={styles.time}
            >
              {formatRemaining(remaining)}
            </p>
          </div>
        </div>

        {intervalPosition !== null ? (
          <p className={styles.position}>{intervalPosition}</p>
        ) : null}

        <div
          aria-atomic="true"
          aria-live="assertive"
          className={styles.liveRegion}
        >
          {announceSignal(signal)}
        </div>

        <div className={styles.actions}>
          {done ? (
            <button
              className={styles.primaryButton}
              onClick={onDismiss}
              type="button"
            >
              Descartar
            </button>
          ) : (
            <button
              className={styles.cancelButton}
              onClick={onCancel}
              type="button"
            >
              Cancelar temporizador
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
