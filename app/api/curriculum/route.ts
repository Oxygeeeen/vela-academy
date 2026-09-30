import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assessments, cohorts, enrollments, lessonAssets, lessonProgress, lessons, phases, programs } from "@/db/schema";
import { apiError, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { refreshEnrollmentProgress } from "@/lib/enrollment";

export async function GET() {
  try {
    const actor = await requireUser();
    const [enrollment] = await db.select({
      id: enrollments.id,
      status: enrollments.status,
      assignedStartDate: enrollments.assignedStartDate,
      timezone: enrollments.timezone,
      progressPercent: enrollments.progressPercent,
      cohortId: cohorts.id,
      cohortName: cohorts.name,
      programId: programs.id,
      programTitle: programs.title,
      programDescription: programs.description,
      classDays: programs.classDays,
    }).from(enrollments)
      .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
      .innerJoin(programs, eq(programs.id, cohorts.programId))
      .where(and(eq(enrollments.userId, actor.id), eq(enrollments.organizationId, actor.organizationId)))
      .orderBy(asc(enrollments.createdAt))
      .limit(1);
    if (!enrollment) throw new ApiError("No active programme enrolment was found.", 404);
    await refreshEnrollmentProgress(enrollment.id);

    const [phaseRows, lessonRows, assetRows, assessmentRows] = await Promise.all([
      db.select().from(phases).where(eq(phases.programId, enrollment.programId)).orderBy(asc(phases.position)),
      db.select({
        id: lessons.id,
        phaseId: lessons.phaseId,
        title: lessons.title,
        description: lessons.description,
        learningObjectives: lessons.learningObjectives,
        assignmentPrompt: lessons.assignmentPrompt,
        durationMinutes: lessons.durationMinutes,
        position: lessons.position,
        releaseOffset: lessons.releaseOffset,
        passMark: lessons.passMark,
        maximumAttempts: lessons.maximumAttempts,
        status: lessonProgress.status,
        availableAt: lessonProgress.availableAt,
        dueAt: lessonProgress.dueAt,
        startedAt: lessonProgress.startedAt,
        lectureCompletedAt: lessonProgress.lectureCompletedAt,
        percentViewed: lessonProgress.percentViewed,
      }).from(lessons)
        .innerJoin(phases, eq(phases.id, lessons.phaseId))
        .innerJoin(lessonProgress, and(
          eq(lessonProgress.lessonId, lessons.id),
          eq(lessonProgress.enrollmentId, enrollment.id),
        ))
        .where(and(eq(phases.programId, enrollment.programId), eq(lessons.status, "published")))
        .orderBy(asc(lessons.releaseOffset), asc(lessons.position)),
      db.select({ asset: lessonAssets }).from(lessonAssets).innerJoin(lessons, eq(lessons.id, lessonAssets.lessonId))
        .innerJoin(phases, eq(phases.id, lessons.phaseId))
        .where(eq(phases.programId, enrollment.programId)),
      db.select({
        id: assessments.id,
        lessonId: assessments.lessonId,
        title: assessments.title,
        instructions: assessments.instructions,
        rubric: assessments.rubric,
        submissionType: assessments.submissionType,
      }).from(assessments).innerJoin(lessons, eq(lessons.id, assessments.lessonId))
        .innerJoin(phases, eq(phases.id, lessons.phaseId))
        .where(eq(phases.programId, enrollment.programId)),
    ]);
    return NextResponse.json({
      enrollment,
      phases: phaseRows,
      lessons: lessonRows,
      assets: assetRows.map((row) => row.asset),
      assessments: assessmentRows,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    return apiError(error);
  }
}
