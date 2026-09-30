import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cohorts, enrollments, lessonProgress, lessons, phases, programs } from "@/db/schema";
import { apiError, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { programAccessState } from "@/lib/program-access";
import { releaseInstant } from "@/lib/schedule";

export async function GET(_request: Request, context: RouteContext<"/api/programs/[id]">) {
  try {
    const actor = await requireUser();
    const { id } = await context.params;
    const [program] = await db.select().from(programs).where(and(
      eq(programs.id, id),
      eq(programs.organizationId, actor.organizationId),
    )).limit(1);
    if (!program) throw new ApiError("Program not found.", 404);

    const privileged = ["owner", "admin", "reviewer", "trainer"].includes(actor.role);
    const [enrollment] = privileged ? [] : await db.select({
      id: enrollments.id,
      status: enrollments.status,
      progressPercent: enrollments.progressPercent,
      assignedStartDate: enrollments.assignedStartDate,
      timezone: enrollments.timezone,
      cohortName: cohorts.name,
    }).from(enrollments)
      .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
      .where(and(
        eq(enrollments.userId, actor.id),
        eq(enrollments.organizationId, actor.organizationId),
        eq(cohorts.programId, id),
      )).limit(1);

    if (!privileged && !enrollment) throw new ApiError("Program not found.", 404);
    const accessState = programAccessState({
      privileged,
      programStatus: program.status,
      classDays: program.classDays,
      enrollment: enrollment ?? null,
    });

    const phaseRows = await db.select().from(phases)
      .where(eq(phases.programId, id))
      .orderBy(asc(phases.position));

    const lessonRows = accessState === "locked"
      ? []
      : privileged
        ? await db.select({
            id: lessons.id,
            phaseId: lessons.phaseId,
            title: lessons.title,
            description: lessons.description,
            durationMinutes: lessons.durationMinutes,
            position: lessons.position,
            releaseOffset: lessons.releaseOffset,
            status: lessons.status,
          }).from(lessons)
            .innerJoin(phases, eq(phases.id, lessons.phaseId))
            .where(eq(phases.programId, id))
            .orderBy(asc(lessons.releaseOffset), asc(lessons.position))
        : await db.select({
            id: lessons.id,
            phaseId: lessons.phaseId,
            title: lessons.title,
            description: lessons.description,
            durationMinutes: lessons.durationMinutes,
            position: lessons.position,
            releaseOffset: lessons.releaseOffset,
            status: lessonProgress.status,
            availableAt: lessonProgress.availableAt,
            dueAt: lessonProgress.dueAt,
          }).from(lessons)
            .innerJoin(phases, eq(phases.id, lessons.phaseId))
            .innerJoin(lessonProgress, and(
              eq(lessonProgress.lessonId, lessons.id),
              eq(lessonProgress.enrollmentId, enrollment!.id),
            ))
            .where(eq(phases.programId, id))
            .orderBy(asc(lessons.releaseOffset), asc(lessons.position));

    return NextResponse.json({
      program,
      accessState,
      enrollment: enrollment ?? null,
      availableAt: !privileged && enrollment
        ? releaseInstant(enrollment.assignedStartDate, 0, enrollment.timezone, program.classDays).toISOString()
        : null,
      phases: phaseRows,
      lessons: lessonRows,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    return apiError(error);
  }
}
