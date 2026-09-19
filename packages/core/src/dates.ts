import { z } from "zod";

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const SCHEDULED_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isCalendarDate(value: string) {
  const match = LOCAL_DATE_PATTERN.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const daysByMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return month >= 1 && month <= 12 && day >= 1 && day <= daysByMonth[month - 1];
}

export const localDateSchema = z
  .string()
  .regex(LOCAL_DATE_PATTERN, "La fecha debe usar YYYY-MM-DD.")
  .refine(isCalendarDate, "La fecha local no existe en el calendario.");

export const scheduledTimeSchema = z
  .string()
  .regex(
    SCHEDULED_TIME_PATTERN,
    "La hora debe usar HH:mm en formato de 24 horas.",
  );

export type LocalDate = z.infer<typeof localDateSchema>;
export type ScheduledTime = z.infer<typeof scheduledTimeSchema>;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function getLocalDate(now: Date = new Date()): LocalDate {
  return localDateSchema.parse(
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
  );
}
