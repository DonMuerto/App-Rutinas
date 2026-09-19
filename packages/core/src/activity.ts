import { z } from "zod";

import { scheduledTimeSchema } from "./dates";

export const ACTIVITY_SCHEMA_VERSION = 1 as const;

export const activityDefaults = {
  schemaVersion: ACTIVITY_SCHEMA_VERSION,
  timerType: "none",
  countdownSeconds: 1_800,
  prepareSeconds: 10,
  workSeconds: 20,
  restSeconds: 10,
  cycles: 8,
  sets: 1,
  restBetweenSetsSeconds: 60,
} as const;

const secondsSchema = (minimum: number, maximum: number) =>
  z.number().finite().int().min(minimum).max(maximum);

export const activityTimerConfigSchema = z.discriminatedUnion("timerType", [
  z.object({ timerType: z.literal("none") }),
  z.object({
    timerType: z.literal("countdown"),
    countdownSeconds: secondsSchema(60, 86_400),
  }),
  z.object({
    timerType: z.literal("interval"),
    prepareSeconds: secondsSchema(0, 3_600),
    workSeconds: secondsSchema(1, 3_600),
    restSeconds: secondsSchema(0, 3_600),
    cycles: secondsSchema(1, 100),
    sets: secondsSchema(1, 20),
    restBetweenSetsSeconds: secondsSchema(0, 3_600),
  }),
]);

export const activityScheduledTimeSchema = z.union([
  scheduledTimeSchema,
  z.literal("").transform(() => undefined),
  z.undefined(),
]);

export type ActivityTimerConfig = z.infer<typeof activityTimerConfigSchema>;
