import { and, asc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { calendarEvents, enrollments, lessonProgress, lessons } from "@/db/schema";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";

function escapeIcs(value: string | null) {
  return (value ?? "").replaceAll("\\", "\\\\").replaceAll(";", "\\;").replaceAll(",", "\\,").replaceAll("\n", "\\n");
}

function icsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export async function GET() {
  try {
    const actor = await requireUser();
    const cohortRows = await db.select({ cohortId: enrollments.cohortId }).from(enrollments)
      .where(eq(enrollments.userId, actor.id));
    const audience = cohortRows.length
      ? or(eq(calendarEvents.userId, actor.id), ...cohortRows.map((row) => eq(calendarEvents.cohortId, row.cohortId)), and(isNull(calendarEvents.userId), isNull(calendarEvents.cohortId)))
      : or(eq(calendarEvents.userId, actor.id), and(isNull(calendarEvents.userId), isNull(calendarEvents.cohortId)));
    const [events, learningWindows] = await Promise.all([
      db.select().from(calendarEvents).where(and(
        eq(calendarEvents.organizationId, actor.organizationId),
        audience,
      )).orderBy(asc(calendarEvents.startsAt)),
      db.select({
        id: lessons.id,
        title: lessons.title,
        description: lessons.description,
        durationMinutes: lessons.durationMinutes,
        availableAt: lessonProgress.availableAt,
        dueAt: lessonProgress.dueAt,
      }).from(lessonProgress)
        .innerJoin(enrollments, eq(enrollments.id, lessonProgress.enrollmentId))
        .innerJoin(lessons, eq(lessons.id, lessonProgress.lessonId))
        .where(eq(enrollments.userId, actor.id))
        .orderBy(asc(lessonProgress.availableAt)),
    ]);
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Vela AI Academy//Learning Calendar//EN",
      "CALSCALE:GREGORIAN",
      ...events.flatMap((event) => [
        "BEGIN:VEVENT",
        `UID:${event.id}@vela-ai-academy`,
        `DTSTAMP:${icsDate(event.createdAt)}`,
        `DTSTART:${icsDate(event.startsAt)}`,
        `DTEND:${icsDate(event.endsAt)}`,
        `SUMMARY:${escapeIcs(event.title)}`,
        `DESCRIPTION:${escapeIcs(event.description)}`,
        event.meetingUrl ? `URL:${escapeIcs(event.meetingUrl)}` : "",
        "END:VEVENT",
      ].filter(Boolean)),
      ...learningWindows.flatMap((lesson) => lesson.availableAt && lesson.dueAt ? [
        "BEGIN:VEVENT",
        `UID:release-${lesson.id}@vela-ai-academy`,
        `DTSTAMP:${icsDate(new Date())}`,
        `DTSTART:${icsDate(lesson.availableAt)}`,
        `DTEND:${icsDate(new Date(lesson.availableAt.getTime() + lesson.durationMinutes * 60_000))}`,
        `SUMMARY:${escapeIcs(`Learning release: ${lesson.title}`)}`,
        `DESCRIPTION:${escapeIcs(lesson.description)}`,
        "END:VEVENT",
        "BEGIN:VEVENT",
        `UID:deadline-${lesson.id}@vela-ai-academy`,
        `DTSTAMP:${icsDate(new Date())}`,
        `DTSTART:${icsDate(new Date(lesson.dueAt.getTime() - 30 * 60_000))}`,
        `DTEND:${icsDate(lesson.dueAt)}`,
        `SUMMARY:${escapeIcs(`Deadline: ${lesson.title}`)}`,
        "END:VEVENT",
      ] : []),
      "END:VCALENDAR",
    ];
    return new Response(lines.join("\r\n"), {
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'attachment; filename="vela-academy-calendar.ics"',
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
