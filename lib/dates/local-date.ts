import { localDateSchema, type LocalDate } from "@/lib/contracts";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function getLocalDate(now: Date = new Date()): LocalDate {
  const value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  return localDateSchema.parse(value);
}
