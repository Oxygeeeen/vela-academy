import { fromZonedTime } from "date-fns-tz";

export const DEFAULT_CLASS_DAYS = [2, 5, 0] as const;

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function isValidTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

export function classDateForOffset(
  assignedStartDate: string,
  releaseOffset: number,
  classDays: number[] = [...DEFAULT_CLASS_DAYS],
) {
  const allowed = new Set(classDays);
  const date = new Date(`${assignedStartDate}T12:00:00Z`);
  let occurrence = allowed.has(date.getUTCDay()) ? 0 : -1;

  while (occurrence < releaseOffset) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (allowed.has(date.getUTCDay())) occurrence += 1;
  }
  return dateKey(date);
}

export function releaseInstant(
  assignedStartDate: string,
  releaseOffset: number,
  timezone: string,
  classDays?: number[],
) {
  const classDate = classDateForOffset(assignedStartDate, releaseOffset, classDays);
  return fromZonedTime(`${classDate}T00:00:00`, timezone);
}

export function lessonWindow(
  assignedStartDate: string,
  releaseOffset: number,
  timezone: string,
  classDays?: number[],
) {
  const availableAt = releaseInstant(assignedStartDate, releaseOffset, timezone, classDays);
  const nextAvailableAt = releaseInstant(assignedStartDate, releaseOffset + 1, timezone, classDays);
  return { availableAt, dueAt: new Date(nextAvailableAt.getTime() - 1) };
}

export function progressionState(input: {
  now?: Date;
  assignedStartDate: string;
  releaseOffset: number;
  timezone: string;
  prerequisitePassed: boolean;
  classDays?: number[];
}) {
  const { availableAt, dueAt } = lessonWindow(
    input.assignedStartDate,
    input.releaseOffset,
    input.timezone,
    input.classDays,
  );
  const now = input.now ?? new Date();
  if (!input.prerequisitePassed) return { state: "prerequisite_locked" as const, availableAt, dueAt };
  if (now < availableAt) return { state: "scheduled" as const, availableAt, dueAt };
  return { state: now > dueAt ? "overdue" as const : "available" as const, availableAt, dueAt };
}

export function zonedDateLabel(date: Date, timezone: string, locale = "en") {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
