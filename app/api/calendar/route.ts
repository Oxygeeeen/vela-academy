import { NextResponse } from "next/server";
import { and, asc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { calendarEvents, enrollments } from "@/db/schema";
import { apiError, ApiError } from "@/lib/api";
import { requireRole, requireUser } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security";

const schema = z.object({
  cohortId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  title: z.string().trim().min(3).max(240),
  description: z.string().trim().max(5000).optional(),
  kind: z.enum(["release", "deadline", "office_hours", "live_session", "panel"]),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  meetingUrl: z.string().url().optional(),
});

export async function GET(request: Request) {
  try {
    const actor = await requireUser();
    const params = new URL(request.url).searchParams;
    const from = new Date(params.get("from") ?? new Date(Date.now() - 30 * 86_400_000).toISOString());
    const to = new Date(params.get("to") ?? new Date(Date.now() + 180 * 86_400_000).toISOString());
    const privileged = ["owner", "admin", "reviewer", "trainer"].includes(actor.role);
    const enrolmentRows = privileged ? [] : await db.select({ cohortId: enrollments.cohortId })
      .from(enrollments).where(eq(enrollments.userId, actor.id));
    const cohortIds = enrolmentRows.map((row) => row.cohortId);
    const audience = privileged
      ? eq(calendarEvents.organizationId, actor.organizationId)
      : cohortIds.length
        ? and(eq(calendarEvents.organizationId, actor.organizationId), or(
            eq(calendarEvents.userId, actor.id),
            ...cohortIds.map((id) => eq(calendarEvents.cohortId, id)),
            and(isNull(calendarEvents.userId), isNull(calendarEvents.cohortId)),
          ))
        : and(eq(calendarEvents.organizationId, actor.organizationId), or(
            eq(calendarEvents.userId, actor.id),
            and(isNull(calendarEvents.userId), isNull(calendarEvents.cohortId)),
          ));
    const events = await db.select().from(calendarEvents).where(and(
      audience,
      gte(calendarEvents.startsAt, from),
      lte(calendarEvents.startsAt, to),
    )).orderBy(asc(calendarEvents.startsAt));
    return NextResponse.json({ data: events });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    const actor = await requireRole(["owner", "admin", "trainer"]);
    const input = schema.parse(await request.json());
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (endsAt <= startsAt) throw new ApiError("Event end time must be after its start time.");
    const [event] = await db.insert(calendarEvents).values({
      organizationId: actor.organizationId,
      cohortId: input.cohortId,
      userId: input.userId,
      title: input.title,
      description: input.description,
      kind: input.kind,
      startsAt,
      endsAt,
      meetingUrl: input.meetingUrl,
    }).returning();
    return NextResponse.json({ data: event }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
