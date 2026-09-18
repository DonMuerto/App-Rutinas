import styles from "./timer.module.css";

import type { TimerPhaseKind } from "@/lib/timer";

export interface TimerRingProps {
  readonly phase: TimerPhaseKind | "done";
  readonly progress: number;
  readonly size?: number;
}

export function TimerRing({ phase, progress, size = 296 }: TimerRingProps) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const boundedProgress = Math.min(1, Math.max(0, progress));

  return (
    <svg
      aria-hidden="true"
      className={styles.ring}
      data-phase={phase}
      height={size}
      viewBox="0 0 100 100"
      width={size}
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
