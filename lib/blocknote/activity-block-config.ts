import { activityDefaults } from "@/lib/contracts";

export const activityPropSchema = {
  schemaVersion: {
    default: activityDefaults.schemaVersion,
    values: [1] as const,
  },
  scheduledTime: { default: activityDefaults.scheduledTime },
  timerType: {
    default: activityDefaults.timerType,
    values: ["none", "countdown", "interval"] as const,
  },
  countdownSeconds: { default: activityDefaults.countdownSeconds },
  prepareSeconds: { default: activityDefaults.prepareSeconds },
  workSeconds: { default: activityDefaults.workSeconds },
  restSeconds: { default: activityDefaults.restSeconds },
  cycles: { default: activityDefaults.cycles },
  sets: { default: activityDefaults.sets },
  restBetweenSetsSeconds: {
    default: activityDefaults.restBetweenSetsSeconds,
  },
} as const;

export const activityBlockConfig = {
  type: "activity",
  propSchema: activityPropSchema,
  content: "inline",
} as const;
