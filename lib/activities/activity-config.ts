import {
  activityScheduledTimeSchema,
  activityTimerConfigSchema,
  type ActivityTimerConfig,
  type ScheduledTime,
} from "@/lib/contracts";

export type ActivityTimerState =
  | { readonly status: "none" }
  | {
      readonly status: "ready";
      readonly config: Exclude<ActivityTimerConfig, { timerType: "none" }>;
    }
  | { readonly status: "invalid"; readonly message: string };

export interface InspectedActivityProps {
  readonly schemaVersionValid: boolean;
  readonly scheduledTime?: ScheduledTime;
  readonly scheduledTimeError?: string;
  readonly timer: ActivityTimerState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function inspectActivityProps(props: unknown): InspectedActivityProps {
  if (!isRecord(props)) {
    return {
      schemaVersionValid: false,
      scheduledTimeError: "Las propiedades de la actividad no son validas.",
      timer: {
        status: "invalid",
        message: "La configuracion del temporizador no es valida.",
      },
    };
  }

  const scheduledTimeResult = activityScheduledTimeSchema.safeParse(
    props.scheduledTime,
  );
  const timerResult = activityTimerConfigSchema.safeParse(props);
  const schemaVersionValid = props.schemaVersion === 1;
  const scheduledTime = scheduledTimeResult.success
    ? scheduledTimeResult.data
    : undefined;

  return {
    schemaVersionValid,
    scheduledTime,
    scheduledTimeError: scheduledTimeResult.success
      ? undefined
      : scheduledTimeResult.error.issues[0]?.message,
    timer:
      schemaVersionValid && timerResult.success
        ? timerResult.data.timerType === "none"
          ? { status: "none" }
          : { status: "ready", config: timerResult.data }
        : {
            status: "invalid",
            message:
              (schemaVersionValid
                ? timerResult.error?.issues[0]?.message
                : "La version de Activity no es compatible.") ??
              "La configuracion del temporizador no es valida.",
          },
  };
}

export function getActivityDurationSeconds(
  timer: ActivityTimerState,
): number | undefined {
  if (timer.status !== "ready") {
    return undefined;
  }

  if (timer.config.timerType === "countdown") {
    return timer.config.countdownSeconds;
  }

  const { config } = timer;
  const work = config.workSeconds * config.cycles * config.sets;
  const cycleRests =
    config.restSeconds * Math.max(0, config.cycles - 1) * config.sets;
  const setRests = config.restBetweenSetsSeconds * Math.max(0, config.sets - 1);

  return config.prepareSeconds + work + cycleRests + setRests;
}

export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours} h ${minutes} min`;
  }

  if (minutes > 0 && seconds > 0) {
    return `${minutes} min ${seconds} s`;
  }

  if (minutes > 0) {
    return `${minutes} min`;
  }

  return `${seconds} s`;
}
