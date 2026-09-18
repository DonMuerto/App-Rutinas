"use client";

import { useState } from "react";

import styles from "./editor.module.css";
import {
  localDateSchema,
  routineNameSchema,
  type Routine,
} from "@/lib/contracts";

type Recurrence = Pick<Routine, "recurrenceType" | "specificDate">;
export type MetadataDraftKey =
  "routine-name" | "routine-icon" | "routine-recurrence";

interface RoutineMetadataProps {
  readonly routine: Routine;
  readonly saveStatus: string;
  readonly onRename: (name: string) => Promise<void>;
  readonly onChangeIcon: (icon: string | null) => Promise<void>;
  readonly onChangeRecurrence: (recurrence: Recurrence) => Promise<void>;
  readonly onDraftChange: (key: MetadataDraftKey, dirty: boolean) => void;
}

export function RoutineMetadataEditor({
  routine,
  saveStatus,
  onRename,
  onChangeIcon,
  onChangeRecurrence,
  onDraftChange,
}: RoutineMetadataProps) {
  const [name, setName] = useState(routine.name);
  const [icon, setIcon] = useState(routine.icon ?? "");
  const [recurrenceType, setRecurrenceType] = useState(routine.recurrenceType);
  const [specificDate, setSpecificDate] = useState(routine.specificDate ?? "");
  const [error, setError] = useState<string>();
  const [pendingFields, setPendingFields] = useState<Set<MetadataDraftKey>>(
    () => new Set(),
  );

  const setPending = (key: MetadataDraftKey, pending: boolean) => {
    setPendingFields((current) => {
      const next = new Set(current);
      if (pending) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const commitName = async () => {
    const result = routineNameSchema.safeParse(name);
    if (!result.success) {
      setError(result.error.issues[0]?.message);
      return;
    }

    if (result.data === routine.name) {
      onDraftChange("routine-name", false);
      return;
    }
    setPending("routine-name", true);
    try {
      setError(undefined);
      await onRename(result.data);
      onDraftChange("routine-name", false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo renombrar.",
      );
    } finally {
      setPending("routine-name", false);
    }
  };

  const commitIcon = async () => {
    const value = icon.trim() || null;
    if (value === routine.icon) {
      onDraftChange("routine-icon", false);
      return;
    }
    setPending("routine-icon", true);
    try {
      setError(undefined);
      await onChangeIcon(value);
      onDraftChange("routine-icon", false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo guardar el icono.",
      );
    } finally {
      setPending("routine-icon", false);
    }
  };

  const selectRecurrence = async (value: "daily" | "specific_date") => {
    setRecurrenceType(value);
    onDraftChange("routine-recurrence", true);
    if (value === "daily") {
      setSpecificDate("");
      setPending("routine-recurrence", true);
      try {
        setError(undefined);
        await onChangeRecurrence({
          recurrenceType: "daily",
          specificDate: null,
        });
        onDraftChange("routine-recurrence", false);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudo guardar la recurrencia.",
        );
      } finally {
        setPending("routine-recurrence", false);
      }
    }
  };

  const commitSpecificDate = async (value: string) => {
    setSpecificDate(value);
    onDraftChange("routine-recurrence", true);
    const result = localDateSchema.safeParse(value);
    if (!result.success) {
      setError(result.error.issues[0]?.message);
      return;
    }

    setPending("routine-recurrence", true);
    try {
      setError(undefined);
      await onChangeRecurrence({
        recurrenceType: "specific_date",
        specificDate: result.data,
      });
      onDraftChange("routine-recurrence", false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo guardar la recurrencia.",
      );
    } finally {
      setPending("routine-recurrence", false);
    }
  };

  return (
    <header className={styles.metadata}>
      <label>
        <span className="sr-only">Icono de la rutina</span>
        <input
          aria-label="Icono de la rutina"
          className={styles.iconInput}
          disabled={pendingFields.has("routine-icon")}
          onBlur={() => void commitIcon()}
          onChange={(event) => {
            const value = event.currentTarget.value;
            setIcon(value);
            onDraftChange(
              "routine-icon",
              (value.trim() || null) !== routine.icon,
            );
          }}
          value={icon}
        />
      </label>
      <input
        aria-label="Nombre de la rutina"
        className={styles.routineName}
        disabled={pendingFields.has("routine-name")}
        onBlur={() => void commitName()}
        onChange={(event) => {
          const value = event.currentTarget.value;
          const parsed = routineNameSchema.safeParse(value);
          setName(value);
          onDraftChange(
            "routine-name",
            !parsed.success || parsed.data !== routine.name,
          );
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        value={name}
      />
      <div className={styles.recurrence}>
        <label>
          <span className="sr-only">Recurrencia</span>
          <select
            aria-label="Recurrencia"
            disabled={pendingFields.has("routine-recurrence")}
            onChange={(event) =>
              void selectRecurrence(
                event.currentTarget.value as "daily" | "specific_date",
              )
            }
            value={recurrenceType}
          >
            <option value="daily">Diaria</option>
            <option value="specific_date">Fecha especifica</option>
          </select>
        </label>
        {recurrenceType === "specific_date" ? (
          <label>
            <span className="sr-only">Fecha especifica</span>
            <input
              aria-label="Fecha especifica"
              disabled={pendingFields.has("routine-recurrence")}
              onChange={(event) =>
                void commitSpecificDate(event.currentTarget.value)
              }
              type="date"
              value={specificDate}
            />
          </label>
        ) : null}
      </div>
      <div aria-live="polite" className={styles.saveStatus} role="status">
        {error ?? saveStatus}
      </div>
    </header>
  );
}
