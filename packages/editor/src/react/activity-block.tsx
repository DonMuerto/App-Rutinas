import type { ReactCustomBlockRenderProps } from "@blocknote/react";
import { Clock3, Play, Settings2 } from "lucide-react";
import { useRef, useState } from "react";
import {
  getActivityDurationSeconds,
  getInlinePlainText,
  inspectActivityProps,
} from "@ritmo/document-model";

import type { activityBlockConfig } from "./activity-schema";
import { ActivitySettings, NumberField } from "./activity-settings";
import { useActivityRuntime } from "./activity-runtime";
import styles from "./editor.module.css";

export type ActivityBlockProps = ReactCustomBlockRenderProps<
  typeof activityBlockConfig
> & {
  contentRef: (node: HTMLElement | null) => void;
};

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return [
    hours > 0 ? `${hours} h` : "",
    minutes > 0 ? `${minutes} min` : "",
    seconds > 0 || (hours === 0 && minutes === 0) ? `${seconds} s` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function ActivityBlock({
  block,
  editor,
  contentRef,
}: ActivityBlockProps) {
  const runtime = useActivityRuntime();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const inspected = inspectActivityProps(block.props);
  const title =
    getInlinePlainText(block.content).trim() || "Actividad sin titulo";
  const stable = runtime?.canUseBlockId(block.id) ?? false;
  const key = runtime
    ? {
        routineId: runtime.routineId,
        scopeActivityBlockId: block.id,
        blockId: block.id,
        blockType: "activity" as const,
        completionDate: runtime.localDate,
      }
    : undefined;
  const completion = key
    ? runtime?.completions.getState(key)
    : { completed: false, pending: false };
  const duration = getActivityDurationSeconds(inspected.timer);

  const closeSettings = () => {
    setSettingsOpen(false);
    requestAnimationFrame(() => settingsButtonRef.current?.focus());
  };

  return (
    <div
      className={styles.activity}
      data-completed={completion?.completed || undefined}
    >
      <div className={styles.activityMain}>
        <span className={styles.activityControls} contentEditable={false}>
          <input
            aria-busy={completion?.pending}
            aria-label={`${completion?.completed ? "Desmarcar" : "Completar"} ${title}`}
            checked={completion?.completed ?? false}
            disabled={!runtime || !stable || completion?.pending}
            onChange={(event) => {
              if (!key || !runtime) return;
              void runtime.completions
                .setCompleted(key, event.currentTarget.checked)
                .catch(() =>
                  runtime.announce("No pudimos guardar el completado."),
                );
            }}
            type="checkbox"
          />
          <Clock3 aria-hidden="true" size={16} />
          <span
            className={
              inspected.scheduledTimeError ? styles.invalidValue : undefined
            }
          >
            {inspected.scheduledTime ?? "Sin hora"}
          </span>
        </span>
        <span
          aria-label="Titulo de la actividad"
          className={styles.activityTitle}
          data-placeholder="Actividad sin titulo"
          ref={contentRef}
        />
        <span className={styles.activityActions} contentEditable={false}>
          <span className={styles.timerSummary}>
            {inspected.timer.status === "none"
              ? "Sin timer"
              : inspected.timer.status === "invalid"
                ? "Timer invalido"
                : formatDuration(duration ?? 0)}
          </span>
          <button
            aria-label={`Iniciar temporizador de ${title}`}
            disabled={
              !stable || inspected.timer.status !== "ready" || !runtime?.timer
            }
            onClick={() => {
              if (inspected.timer.status !== "ready" || !runtime?.timer) return;
              void Promise.resolve(
                runtime.timer.start({
                  origin: {
                    routineId: runtime.routineId,
                    routineName: runtime.routineName,
                    activityBlockId: block.id,
                    activityTitle: title,
                  },
                  config: inspected.timer.config,
                }),
              ).then((result) => {
                if (!result.ok && result.reason === "occupied") {
                  runtime.timer?.openFocus();
                  runtime.announce("Ya hay un temporizador activo.");
                }
              });
            }}
            type="button"
          >
            <Play aria-hidden="true" size={15} />
            Start
          </button>
          <button
            aria-label={`Configurar ${title}`}
            disabled={!inspected.schemaVersionValid}
            onClick={() => setSettingsOpen(true)}
            ref={settingsButtonRef}
            type="button"
          >
            <Settings2 aria-hidden="true" size={16} />
          </button>
        </span>
      </div>
      <ActivitySettings
        onClose={closeSettings}
        open={settingsOpen}
        title={`Configurar ${title}`}
      >
        <label className={styles.textField}>
          Hora programada
          <input
            aria-invalid={Boolean(inspected.scheduledTimeError)}
            inputMode="numeric"
            onChange={(event) =>
              editor.updateBlock(block, {
                props: { scheduledTime: event.currentTarget.value },
              })
            }
            placeholder="HH:mm"
            value={String(block.props.scheduledTime)}
          />
        </label>
        <label className={styles.textField}>
          Temporizador
          <select
            onChange={(event) =>
              editor.updateBlock(block, {
                props: { timerType: event.currentTarget.value },
              })
            }
            value={String(block.props.timerType)}
          >
            <option value="none">Sin temporizador</option>
            <option value="countdown">Cuenta regresiva</option>
            <option value="interval">Intervalos</option>
          </select>
        </label>
        {block.props.timerType === "countdown" ? (
          <NumberField
            label="Duracion"
            max={86_400}
            min={60}
            onChange={(countdownSeconds) =>
              editor.updateBlock(block, { props: { countdownSeconds } })
            }
            step={60}
            unit="segundos"
            value={block.props.countdownSeconds}
          />
        ) : null}
        {block.props.timerType === "interval" ? (
          <div className={styles.intervalFields}>
            {(
              [
                ["Preparacion", "prepareSeconds", 0, 3_600, 5, "segundos"],
                ["Trabajo", "workSeconds", 1, 3_600, 5, "segundos"],
                ["Descanso", "restSeconds", 0, 3_600, 5, "segundos"],
                ["Ciclos", "cycles", 1, 100, 1, "ciclos"],
                ["Sets", "sets", 1, 20, 1, "sets"],
                [
                  "Descanso entre sets",
                  "restBetweenSetsSeconds",
                  0,
                  3_600,
                  5,
                  "segundos",
                ],
              ] as const
            ).map(([label, property, min, max, step, unit]) => (
              <NumberField
                key={property}
                label={label}
                max={max}
                min={min}
                onChange={(value) =>
                  editor.updateBlock(block, { props: { [property]: value } })
                }
                step={step}
                unit={unit}
                value={block.props[property]}
              />
            ))}
          </div>
        ) : null}
        {inspected.scheduledTimeError ? (
          <p className={styles.errorText}>{inspected.scheduledTimeError}</p>
        ) : null}
        {inspected.timer.status === "invalid" ? (
          <p className={styles.errorText}>{inspected.timer.message}</p>
        ) : null}
      </ActivitySettings>
    </div>
  );
}
