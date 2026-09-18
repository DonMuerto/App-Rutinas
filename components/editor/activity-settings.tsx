"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

import styles from "./editor.module.css";

interface ActivitySettingsProps {
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

export function ActivitySettings({
  open,
  title,
  onClose,
  children,
}: ActivitySettingsProps) {
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
        <button
          aria-label="Cerrar configuracion"
          onClick={onClose}
          type="button"
        >
          Cerrar
        </button>
      </div>
      <div className={styles.settingsBody}>{children}</div>
    </dialog>
  );
}

interface NumberFieldProps {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly unit: string;
  readonly onChange: (value: number) => void;
}

export function NumberField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: NumberFieldProps) {
  const valueIsValid = Number.isInteger(value) && value >= min && value <= max;
  const decrement = valueIsValid ? Math.max(min, value - step) : min;
  const increment = valueIsValid ? Math.min(max, value + step) : min;

  return (
    <fieldset className={styles.numberField}>
      <legend>{label}</legend>
      <button
        aria-label={`Reducir ${label.toLowerCase()} a ${decrement} ${unit}`}
        disabled={valueIsValid && value <= min}
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
          const nextValue = event.currentTarget.valueAsNumber;
          if (
            Number.isInteger(nextValue) &&
            nextValue >= min &&
            nextValue <= max
          ) {
            onChange(nextValue);
          }
        }}
        step={step}
        type="number"
        value={Number.isFinite(value) ? value : ""}
      />
      <span>{unit}</span>
      <button
        aria-label={`Aumentar ${label.toLowerCase()} a ${increment} ${unit}`}
        disabled={valueIsValid && value >= max}
        onClick={() => onChange(increment)}
        type="button"
      >
        +
      </button>
    </fieldset>
  );
}
