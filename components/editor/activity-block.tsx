"use client";

import { Clock3, Play, Settings2 } from "lucide-react";
import { useRef, useState } from "react";
import type { ReactCustomBlockRenderProps } from "@blocknote/react";

import { ActivitySettings, NumberField } from "./activity-settings";
import { useActivityRuntime } from "./activity-runtime";
import styles from "./editor.module.css";
import {
  formatDuration,
  getActivityDurationSeconds,
  inspectActivityProps,
} from "@/lib/activities/activity-config";
import type { activityBlockConfig } from "@/lib/blocknote/activity-block-config";
import { getInlinePlainText } from "@/lib/blocknote/inline-text";

type Props = ReactCustomBlockRenderProps<typeof activityBlockConfig>;

export function ActivityBlock({ block, editor, contentRef }: Props) {
  const runtime = useActivityRuntime();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const inspected = inspectActivityProps(block.props);
  const duration = getActivityDurationSeconds(inspected.timer);
  const title = getInlinePlainText(block.content) || "Actividad sin titulo";
  const hasStableId = runtime?.canUseBlockId?.(block.id) ?? true;
  const completed = hasStableId
    ? (runtime?.isCompleted(block.id, block.id) ?? false)
    : false;
  const completionPending =
    hasStableId &&
    (runtime?.isCompletionPending?.(block.id, block.id) ?? false);
  const canStart =
    hasStableId && inspected.timer.status === "ready" && runtime?.startTimer;

  const updateProps = (props: Partial<typeof block.props>) => {
    editor.updateBlock(block, { props });
  };

  return (
    <div className={styles.activity} data-completed={completed || undefined}>
      <div className={styles.activityMain}>
        <span className={styles.activityControls} contentEditable={false}>
          <input
            aria-label={`Completar ${title}`}
            aria-busy={completionPending}
            checked={completed}
            disabled={!runtime || !hasStableId || completionPending}
            onChange={(event) => {
              if (!runtime) return;
              void runtime.toggleCompletion(
                {
                  routineId: runtime.routineId,
                  scopeActivityBlockId: block.id,
                  blockId: block.id,
                  blockType: "activity",
                  completionDate: runtime.localDate,
                },
                event.currentTarget.checked,
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
                : duration === undefined
                  ? "Timer"
                  : formatDuration(duration)}
          </span>
          <button
            aria-label={`Iniciar temporizador de ${title}`}
            disabled={!canStart}
            onClick={() => {
              if (inspected.timer.status !== "ready" || !runtime?.startTimer) {
                return;
              }
              void runtime.startTimer({
                routineId: runtime.routineId,
                routineName: runtime.routineName,
                activityBlockId: block.id,
                activityTitle: title,
                config: inspected.timer.config,
              });
            }}
            title={
              inspected.timer.status === "invalid"
                ? inspected.timer.message
                : undefined
            }
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
            title={
              inspected.schemaVersionValid
                ? undefined
                : "La version de Activity no es compatible."
            }
            type="button"
          >
            <Settings2 aria-hidden="true" size={16} />
          </button>
        </span>
      </div>

      <ActivitySettings
        onClose={() => {
          setSettingsOpen(false);
          requestAnimationFrame(() => settingsButtonRef.current?.focus());
        }}
        open={settingsOpen}
        title={`Configurar ${title}`}
      >
        <label className={styles.textField}>
          Hora programada
          <input
            aria-describedby={
              inspected.scheduledTimeError
                ? `activity-time-error-${block.id}`
                : undefined
            }
            inputMode="numeric"
            onChange={(event) =>
              updateProps({ scheduledTime: event.currentTarget.value })
            }
            placeholder="HH:mm"
            value={String(block.props.scheduledTime)}
          />
        </label>
        {inspected.scheduledTimeError ? (
          <p
            className={styles.errorText}
            id={`activity-time-error-${block.id}`}
          >
            {inspected.scheduledTimeError}
          </p>
        ) : null}

        <label className={styles.textField}>
          Temporizador
          <select
            onChange={(event) =>
              updateProps({
                timerType: event.currentTarget
                  .value as typeof block.props.timerType,
              })
            }
            value={block.props.timerType}
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
            onChange={(countdownSeconds) => updateProps({ countdownSeconds })}
            step={60}
            unit="segundos"
            value={block.props.countdownSeconds}
          />
        ) : null}

        {block.props.timerType === "interval" ? (
          <div className={styles.intervalFields}>
            <NumberField
              label="Preparacion"
              max={3_600}
              min={0}
              onChange={(prepareSeconds) => updateProps({ prepareSeconds })}
              step={5}
              unit="segundos"
              value={block.props.prepareSeconds}
            />
            <NumberField
              label="Trabajo"
              max={3_600}
              min={1}
              onChange={(workSeconds) => updateProps({ workSeconds })}
              step={5}
              unit="segundos"
              value={block.props.workSeconds}
            />
            <NumberField
              label="Descanso"
              max={3_600}
              min={0}
              onChange={(restSeconds) => updateProps({ restSeconds })}
              step={5}
              unit="segundos"
              value={block.props.restSeconds}
            />
            <NumberField
              label="Ciclos"
              max={100}
              min={1}
              onChange={(cycles) => updateProps({ cycles })}
              step={1}
              unit="ciclos"
              value={block.props.cycles}
            />
            <NumberField
              label="Sets"
              max={20}
              min={1}
              onChange={(sets) => updateProps({ sets })}
              step={1}
              unit="sets"
              value={block.props.sets}
            />
            <NumberField
              label="Descanso entre sets"
              max={3_600}
              min={0}
              onChange={(restBetweenSetsSeconds) =>
                updateProps({ restBetweenSetsSeconds })
              }
              step={5}
              unit="segundos"
              value={block.props.restBetweenSetsSeconds}
            />
          </div>
        ) : null}

        {inspected.timer.status === "invalid" ? (
          <p className={styles.errorText} role="status">
            {inspected.timer.message}
          </p>
        ) : null}
      </ActivitySettings>
    </div>
  );
}
