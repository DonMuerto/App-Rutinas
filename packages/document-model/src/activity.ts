import {
  activityScheduledTimeSchema,
  activityTimerConfigSchema,
  type ActivityTimerConfig,
  type ScheduledTime,
} from "@ritmo/core";

import { isRecord } from "./types";

export type ActivityTimerState =
  | { status: "none" }
  | {
      status: "ready";
      config: Exclude<ActivityTimerConfig, { timerType: "none" }>;
    }
  | { status: "invalid"; message: string };

export interface InspectedActivityProps {
  schemaVersionValid: boolean;
  scheduledTime?: ScheduledTime;
  scheduledTimeError?: string;
  timer: ActivityTimerState;
}

export function inspectActivityProps(props: unknown): InspectedActivityProps {
  if (!isRecord(props)) {
    return {
      schemaVersionValid: false,
      scheduledTimeError: "Las propiedades de Activity no son validas.",
      timer: {
        status: "invalid",
        message: "La configuracion del temporizador no es valida.",
      },
    };
  }

  const schemaVersionValid = props.schemaVersion === 1;
  const scheduledTimeResult = activityScheduledTimeSchema.safeParse(
    props.scheduledTime,
  );
  const timerResult = activityTimerConfigSchema.safeParse(props);

  return {
    schemaVersionValid,
    scheduledTime: scheduledTimeResult.success
      ? scheduledTimeResult.data
      : undefined,
    scheduledTimeError: scheduledTimeResult.success
      ? undefined
      : (scheduledTimeResult.error.issues[0]?.message ??
        "La hora programada no es valida."),
    timer:
      schemaVersionValid && timerResult.success
        ? timerResult.data.timerType === "none"
          ? { status: "none" }
          : { status: "ready", config: timerResult.data }
        : {
            status: "invalid",
            message: schemaVersionValid
              ? "La configuracion del temporizador no es valida."
              : "La version de Activity no es compatible.",
          },
  };
}

export function getActivityDurationSeconds(
  timer: ActivityTimerState,
): number | undefined {
  if (timer.status !== "ready") return undefined;
  if (timer.config.timerType === "countdown") {
    return timer.config.countdownSeconds;
  }

  const { config } = timer;
  return (
    config.prepareSeconds +
    config.workSeconds * config.cycles * config.sets +
    config.restSeconds * Math.max(0, config.cycles - 1) * config.sets +
    config.restBetweenSetsSeconds * Math.max(0, config.sets - 1)
  );
}
