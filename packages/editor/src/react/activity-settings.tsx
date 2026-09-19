import { useEffect, useId, useRef, type ReactNode } from "react";

import styles from "./editor.module.css";

export function ActivitySettings({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose(): void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (window.matchMedia("(max-width: 47.99rem)").matches) {
        dialog.showModal();
      } else {
        dialog.show();
        dialog.querySelector<HTMLElement>("input, select, button")?.focus();
      }
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      aria-labelledby={titleId}
      className={styles.settingsDialog}
      onCancel={onClose}
      onClose={onClose}
      ref={dialogRef}
    >
      <div className={styles.settingsHeader}>
        <h2 id={titleId}>{title}</h2>
        <button onClick={onClose} type="button">
          Cerrar
        </button>
      </div>
      <div className={styles.settingsBody}>{children}</div>
    </dialog>
  );
}

export function NumberField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange(value: number): void;
}) {
  const valid = Number.isInteger(value) && value >= min && value <= max;
  const decrement = valid ? Math.max(min, value - step) : min;
  const increment = valid ? Math.min(max, value + step) : min;

  return (
    <fieldset className={styles.numberField}>
      <legend>{label}</legend>
      <button
        aria-label={`Reducir ${label.toLowerCase()} a ${decrement} ${unit}`}
        disabled={valid && value <= min}
        onClick={() => onChange(decrement)}
        type="button"
      >
        -
      </button>
      <input
        aria-label={`${label} en ${unit}`}
        inputMode="numeric"
        max={max}
        min={min}
        onChange={(event) => {
          const next = event.currentTarget.valueAsNumber;
          if (Number.isInteger(next) && next >= min && next <= max) {
            onChange(next);
          }
        }}
        step={step}
        type="number"
        value={Number.isFinite(value) ? value : ""}
      />
      <span>{unit}</span>
      <button
        aria-label={`Aumentar ${label.toLowerCase()} a ${increment} ${unit}`}
        disabled={valid && value >= max}
        onClick={() => onChange(increment)}
        type="button"
      >
        +
      </button>
    </fieldset>
  );
}
