import type { TodayActivity } from "../contracts";

export function compareTodayActivities(
  left: TodayActivity,
  right: TodayActivity,
) {
  if (left.scheduledTime !== right.scheduledTime) {
    if (!left.scheduledTime) return 1;
    if (!right.scheduledTime) return -1;
    const timeOrder = left.scheduledTime.localeCompare(right.scheduledTime);
    if (timeOrder !== 0) return timeOrder;
  }

  return (
    left.routinePosition - right.routinePosition ||
    left.documentOrder - right.documentOrder ||
    left.routineId.localeCompare(right.routineId) ||
    (left.activityBlockId ?? "").localeCompare(right.activityBlockId ?? "")
  );
}

export function sortTodayActivities(activities: readonly TodayActivity[]) {
  return [...activities].sort(compareTodayActivities);
}
