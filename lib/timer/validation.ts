import {
  activityTimerConfigSchema,
  type ActivityTimerConfig,
} from "@/lib/contracts";

export type RunnableTimerConfig = Exclude<
  ActivityTimerConfig,
  { timerType: "none" }
>;

export interface TimerValidationIssue {
  readonly message: string;
  readonly path: readonly PropertyKey[];
}

export type TimerValidationResult =
  | { readonly success: true; readonly data: RunnableTimerConfig }
  | {
      readonly success: false;
      readonly issues: readonly TimerValidationIssue[];
    };

export class TimerValidationError extends Error {
  readonly issues: readonly TimerValidationIssue[];

  constructor(issues: readonly TimerValidationIssue[]) {
    super(issues.map((issue) => issue.message).join(" "));
    this.name = "TimerValidationError";
    this.issues = issues;
  }
}

export function validateRunnableTimerConfig(
  input: unknown,
): TimerValidationResult {
  const result = activityTimerConfigSchema.safeParse(input);

  if (!result.success) {
    return {
      success: false,
      issues: result.error.issues.map((issue) => ({
        message: issue.message,
        path: issue.path,
      })),
    };
  }

  if (result.data.timerType === "none") {
    return {
      success: false,
      issues: [
        {
          message: "La actividad no tiene un temporizador configurado.",
          path: ["timerType"],
        },
      ],
    };
  }

  return { success: true, data: result.data };
}

export function parseRunnableTimerConfig(input: unknown): RunnableTimerConfig {
  const result = validateRunnableTimerConfig(input);

  if (!result.success) {
    throw new TimerValidationError(result.issues);
  }

  return result.data;
}
