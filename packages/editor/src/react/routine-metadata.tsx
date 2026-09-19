import { useState } from "react";
import { localDateSchema, routineNameSchema, type Routine } from "@ritmo/core";

import styles from "./editor.module.css";

type Recurrence = Pick<Routine, "recurrenceType" | "specificDate">;

export function RoutineMetadataEditor({
  routine,
  saveStatus,
  onRename,
  onChangeIcon,
  onChangeRecurrence,
}: {
  routine: Routine;
  saveStatus: string;
  onRename(name: string): Promise<void>;
  onChangeIcon(icon: string | null): Promise<void>;
  onChangeRecurrence(recurrence: Recurrence): Promise<void>;
}) {
  const [name, setName] = useState(routine.name);
  const [icon, setIcon] = useState(routine.icon ?? "");
  const [recurrenceType, setRecurrenceType] = useState(routine.recurrenceType);
  const [specificDate, setSpecificDate] = useState(routine.specificDate ?? "");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const run = async (operation: () => Promise<void>, rollback: () => void) => {
    setPending(true);
    setError(undefined);
    try {
      await operation();
    } catch (cause) {
      rollback();
      setError(cause instanceof Error ? cause.message : "No se pudo guardar.");
    } finally {
      setPending(false);
    }
  };

  return (
    <header className={styles.metadata}>
      <label>
        <span className={styles.visuallyHidden}>Icono de la rutina</span>
        <input
          aria-label="Icono de la rutina"
          className={styles.iconInput}
          disabled={pending}
          onBlur={() => {
            const value = icon.trim() || null;
            if (value !== routine.icon) {
              void run(
                () => onChangeIcon(value),
                () => setIcon(routine.icon ?? ""),
              );
            }
          }}
          onChange={(event) => setIcon(event.currentTarget.value)}
          value={icon}
        />
      </label>
      <input
        aria-label="Nombre de la rutina"
        className={styles.routineName}
        disabled={pending}
        onBlur={() => {
          const parsed = routineNameSchema.safeParse(name);
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message);
          } else if (parsed.data !== routine.name) {
            void run(
              () => onRename(parsed.data),
              () => setName(routine.name),
            );
          }
        }}
        onChange={(event) => setName(event.currentTarget.value)}
        value={name}
      />
      <div className={styles.recurrence}>
        <select
          aria-label="Recurrencia"
          disabled={pending}
          onChange={(event) => {
            const value = event.currentTarget.value as
              "daily" | "specific_date";
            setRecurrenceType(value);
            if (value === "daily") {
              setSpecificDate("");
              void run(
                () =>
                  onChangeRecurrence({
                    recurrenceType: "daily",
                    specificDate: null,
                  }),
                () => {
                  setRecurrenceType(routine.recurrenceType);
                  setSpecificDate(routine.specificDate ?? "");
                },
              );
            }
          }}
          value={recurrenceType}
        >
          <option value="daily">Diaria</option>
          <option value="specific_date">Fecha especifica</option>
        </select>
        {recurrenceType === "specific_date" ? (
          <input
            aria-label="Fecha especifica"
            disabled={pending}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setSpecificDate(value);
              const parsed = localDateSchema.safeParse(value);
              if (parsed.success) {
                void run(
                  () =>
                    onChangeRecurrence({
                      recurrenceType: "specific_date",
                      specificDate: parsed.data,
                    }),
                  () => {
                    setRecurrenceType(routine.recurrenceType);
                    setSpecificDate(routine.specificDate ?? "");
                  },
                );
              }
            }}
            type="date"
            value={specificDate}
          />
        ) : null}
      </div>
      <div aria-live="polite" className={styles.saveStatus} role="status">
        {error ?? saveStatus}
      </div>
    </header>
  );
}
