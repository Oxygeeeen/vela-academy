import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { cohorts, programs } from "@/db/schema";
import { apiError, ApiError } from "@/lib/api";
import { requireRole } from "@/lib/auth/session";
import { writeAuditEvent } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/security";
import { isValidTimezone } from "@/lib/schedule";

const schema = z.object({
  programId: z.string().uuid(),
  name: z.string().trim().min(3).max(120),
  startDate: z.string().date(),
  endDate: z.string().date(),
  timezonePolicy: z.enum(["learner", "cohort"]).default("learner"),
  cohortTimezone: z.string().max(80).optional(),
  capacity: z.number().int().min(1).max(100_000).optional(),
  status: z.enum(["draft", "active"]).default("draft"),
});

export async function GET() {
  try {
    const actor = await requireRole(["owner", "admin", "reviewer", "trainer"]);
    const rows = await db.select({
      id: cohorts.id,
      name: cohorts.name,
      startDate: cohorts.startDate,
      endDate: cohorts.endDate,
      status: cohorts.status,
      capacity: cohorts.capacity,
      timezonePolicy: cohorts.timezonePolicy,
      cohortTimezone: cohorts.cohortTimezone,
      programId: programs.id,
      programTitle: programs.title,
    }).from(cohorts)
      .innerJoin(programs, eq(programs.id, cohorts.programId))
      .where(eq(cohorts.organizationId, actor.organizationId))
      .orderBy(asc(cohorts.startDate));
    return NextResponse.json({ data: rows });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    const actor = await requireRole(["owner", "admin"]);
    const input = schema.parse(await request.json());
    if (input.endDate <= input.startDate) throw new ApiError("Cohort end date must be after the start date.");
    if (input.timezonePolicy === "cohort" && (!input.cohortTimezone || !isValidTimezone(input.cohortTimezone))) {
      throw new ApiError("A valid cohort timezone is required.");
    }
    const [program] = await db.select({ id: programs.id }).from(programs).where(and(
      eq(programs.id, input.programId),
      eq(programs.organizationId, actor.organizationId),
    )).limit(1);
    if (!program) throw new ApiError("Program not found.", 404);
    const [cohort] = await db.insert(cohorts).values({
      organizationId: actor.organizationId,
      ...input,
    }).returning();
    await writeAuditEvent({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: "cohort.created",
      entityType: "cohort",
      entityId: cohort.id,
    });
    return NextResponse.json({ data: cohort }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
