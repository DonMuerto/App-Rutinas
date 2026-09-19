import { useEffect, useId, useRef, useState } from "react";

import styles from "./timer.module.css";
import type { TimerSignal } from "./controller";
import type {
  DoneTimerState,
  RunningTimerState,
  TimerPhaseKind,
} from "./engine";
import { useTimer } from "./use-timer";

const phaseLabels: Record<TimerPhaseKind | "done", string> = {
  prepare: "Preparación",
  work: "Trabajo",
  "cycle-rest": "Descanso de ciclo",
  "set-rest": "Descanso entre sets",
  done: "Finalizado",
};

type OccupiedTimerState = RunningTimerState | DoneTimerState;

function formatRemaining(seconds: number): string {
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainingSeconds = seconds % 60;
  const minuteSecond = `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;

  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${minuteSecond}`
    : minuteSecond;
}

function remainingLabel(seconds: number): string {
  return `${seconds} ${seconds === 1 ? "segundo restante" : "segundos restantes"}`;
}

function intervalPosition(timer: OccupiedTimerState): string | null {
  if (timer.status !== "running" || timer.mode !== "interval") {
    return null;
  }

  const sets = timer.plan.sets ?? 1;
  const cycles = timer.plan.cycles ?? 1;
  const set = timer.phase.set ?? 1;

  if (timer.phase.kind === "prepare") {
    return `Preparación / Set 1 de ${sets}`;
  }

  if (timer.phase.kind === "set-rest") {
    return `Entre sets ${set} y ${set + 1}`;
  }

  return `Ciclo ${timer.phase.cycle ?? 1} de ${cycles} / Set ${set} de ${sets}`;
}

function announceSignal(signal: TimerSignal | null): string {
  if (signal === null) {
    return "";
  }

  if (signal.kind === "done") {
    return "Temporizador finalizado";
  }

  if (signal.transition.type !== "phase-changed") {
    return "";
  }

  const phase = signal.transition.to;
  const position = [
    phase.cycle === undefined ? null : `ciclo ${phase.cycle}`,
    phase.set === undefined ? null : `set ${phase.set}`,
  ]
    .filter((part) => part !== null)
    .join(", ");

  return `Fase: ${phaseLabels[phase.kind]}${position === "" ? "" : `. ${position}`}`;
}

function TimerRing({
  phase,
  progress,
}: {
  readonly phase: TimerPhaseKind | "done";
  readonly progress: number;
}) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const boundedProgress = Math.min(1, Math.max(0, progress));

  return (
    <svg
      aria-hidden="true"
      className={styles.ring}
      data-phase={phase}
      viewBox="0 0 100 100"
    >
      <circle className={styles.ringTrack} cx="50" cy="50" r={radius} />
      <circle
        className={styles.ringProgress}
        cx="50"
        cy="50"
        r={radius}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - boundedProgress)}
      />
    </svg>
  );
}

function focusableElements(root: HTMLElement | null): HTMLElement[] {
  if (root === null) {
    return [];
  }

  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

function TimerFocus({
  onCancel,
  onClose,
  onDismiss,
  signal,
  timer,
}: {
  readonly onCancel: () => void;
  readonly onClose: () => void;
  readonly onDismiss: () => void;
  readonly signal: TimerSignal | null;
  readonly timer: OccupiedTimerState;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const detailsId = useId();

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    focusableElements(dialogRef.current)[0]?.focus();

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const dialog = dialogRef.current;
      const controls = focusableElements(dialog);
      const first = controls[0];
      const last = controls.at(-1);

      if (dialog === null || first === undefined || last === undefined) {
        event.preventDefault();
        dialog?.focus();
        return;
      }

      if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);

      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      } else {
        queueMicrotask(() => {
          document
            .querySelector<HTMLElement>("[data-timer-focus-trigger]")
            ?.focus();
        });
      }
    };
  }, [onClose]);

  const done = timer.status === "done";
  const phase = done ? "done" : timer.phase.kind;
  const remaining = done ? 0 : timer.remainingSeconds;
  const progress = done ? 1 : timer.progress;
  const position = intervalPosition(timer);
  const activityTitle =
    timer.origin.activityTitle.trim() || "Actividad sin título";

  return (
    <div className={styles.backdrop}>
      <div
        aria-describedby={detailsId}
        aria-labelledby={titleId}
        aria-modal="true"
        className={styles.dialog}
        data-phase={phase}
        data-transition-signal={signal?.kind}
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
          <span aria-hidden="true">{"\u00d7"}</span>
        </button>

        {signal === null ? null : (
          <span
            aria-hidden="true"
            className={styles.signalFlare}
            key={signal.id}
          />
        )}

        <header className={styles.header}>
          <p className={styles.routine}>{timer.origin.routineName}</p>
          <h2 className={styles.title} id={titleId}>
            {activityTitle}
          </h2>
        </header>

        <div className={styles.timerFace}>
          <TimerRing phase={phase} progress={progress} />
          <div className={styles.timerText}>
            <p className={styles.phase}>{phaseLabels[phase]}</p>
            <p aria-label={remainingLabel(remaining)} className={styles.time}>
              {formatRemaining(remaining)}
            </p>
          </div>
        </div>

        <div className={styles.details} id={detailsId}>
          {position === null ? null : <p>{position}</p>}
          <p>{Math.round(progress * 100)}% de la fase</p>
        </div>
        <div
          aria-label="Progreso de la fase"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={Math.round(progress * 100)}
          className={styles.visuallyHidden}
          role="progressbar"
        />

        <div
          aria-atomic="true"
          aria-live="assertive"
          className={styles.visuallyHidden}
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

function TimerDock({
  onOpen,
  onFocusRestored,
  restoreFocus,
  signal,
  timer,
}: {
  readonly onOpen: () => void;
  readonly onFocusRestored: () => void;
  readonly restoreFocus: boolean;
  readonly signal: TimerSignal | null;
  readonly timer: OccupiedTimerState;
}) {
  const done = timer.status === "done";
  const phase = done ? "done" : timer.phase.kind;
  const remaining = done ? 0 : timer.remainingSeconds;
  const position = intervalPosition(timer);
  const activityTitle =
    timer.origin.activityTitle.trim() || "Actividad sin título";

  return (
    <aside
      aria-label="Temporizador activo"
      className={styles.dock}
      data-phase={phase}
    >
      {signal === null ? null : (
        <span aria-hidden="true" className={styles.dockPulse} key={signal.id} />
      )}
      <div className={styles.dockCopy}>
        <p className={styles.dockOrigin}>
          <span>{timer.origin.routineName}</span>
          <strong>{activityTitle}</strong>
        </p>
        <p className={styles.dockStatus}>
          <span>{phaseLabels[phase]}</span>
          <span aria-label={remainingLabel(remaining)}>
            {formatRemaining(remaining)}
          </span>
          {position === null ? null : <span>{position}</span>}
        </p>
      </div>
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
      <div
        aria-atomic="true"
        aria-live="assertive"
        className={styles.visuallyHidden}
      >
        {announceSignal(signal)}
      </div>
    </aside>
  );
}

export function TimerSurface() {
  const timer = useTimer();
  const [restoreFocusToDock, setRestoreFocusToDock] = useState(false);

  if (timer.timer.status === "idle") {
    return null;
  }

  if (timer.focusOpen) {
    return (
      <TimerFocus
        onCancel={() => {
          setRestoreFocusToDock(false);
          void timer.cancel();
        }}
        onClose={timer.closeFocus}
        onDismiss={() => {
          setRestoreFocusToDock(false);
          void timer.dismiss();
        }}
        signal={timer.signal}
        timer={timer.timer}
      />
    );
  }

  return (
    <TimerDock
      onFocusRestored={() => {
        setRestoreFocusToDock(false);
      }}
      onOpen={() => {
        setRestoreFocusToDock(true);
        timer.openFocus();
      }}
      restoreFocus={restoreFocusToDock}
      signal={timer.signal}
      timer={timer.timer}
    />
  );
}
