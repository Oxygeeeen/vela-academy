import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { cohorts, enrollments, lessonProgress, lessons, phases, programs } from "@/db/schema";
import { lessonWindow } from "@/lib/schedule";
import { ApiError } from "@/lib/api";

export async function initializeEnrollmentProgress(input: {
  enrollmentId: string;
  cohortId: string;
  assignedStartDate: string;
  timezone: string;
}) {
  const [cohort] = await db
    .select({ programId: cohorts.programId, classDays: programs.classDays })
    .from(cohorts)
    .innerJoin(programs, eq(programs.id, cohorts.programId))
    .where(eq(cohorts.id, input.cohortId))
    .limit(1);
  if (!cohort) throw new ApiError("Cohort not found.", 404);

  const curriculum = await db
    .select({ id: lessons.id, releaseOffset: lessons.releaseOffset })
    .from(lessons)
    .innerJoin(phases, eq(phases.id, lessons.phaseId))
    .where(and(eq(phases.programId, cohort.programId), eq(lessons.status, "published")))
    .orderBy(asc(lessons.releaseOffset), asc(lessons.position));

  if (!curriculum.length) return;
  const now = new Date();
  await db.insert(lessonProgress).values(curriculum.map((lesson, index) => {
    const window = lessonWindow(
      input.assignedStartDate,
      lesson.releaseOffset,
      input.timezone,
      cohort.classDays,
    );
    return {
      enrollmentId: input.enrollmentId,
      lessonId: lesson.id,
      status: index === 0 && now >= window.availableAt ? "available" as const : "locked" as const,
      availableAt: window.availableAt,
      dueAt: window.dueAt,
    };
  })).onConflictDoNothing();
}

export async function refreshEnrollmentProgress(enrollmentId: string) {
  const [enrollment] = await db
    .select({
      assignedStartDate: enrollments.assignedStartDate,
      timezone: enrollments.timezone,
      cohortId: enrollments.cohortId,
      status: enrollments.status,
    })
    .from(enrollments)
    .where(eq(enrollments.id, enrollmentId))
    .limit(1);
  if (!enrollment || enrollment.status !== "active") return { unlocked: 0 };

  const records = await db
    .select({
      lessonId: lessonProgress.lessonId,
      status: lessonProgress.status,
      availableAt: lessonProgress.availableAt,
      releaseOffset: lessons.releaseOffset,
    })
    .from(lessonProgress)
    .innerJoin(lessons, eq(lessons.id, lessonProgress.lessonId))
    .innerJoin(phases, eq(phases.id, lessons.phaseId))
    .where(and(eq(lessonProgress.enrollmentId, enrollmentId), eq(lessons.status, "published")))
    .orderBy(asc(lessons.releaseOffset), asc(phases.position), asc(lessons.position));

  let previousPassed = true;
  const unlockIds: string[] = [];
  const now = new Date();
  for (const record of records) {
    if (record.status === "locked" && previousPassed && record.availableAt && now >= record.availableAt) {
      unlockIds.push(record.lessonId);
    }
    previousPassed = record.status === "passed";
  }
  if (unlockIds.length) {
    await db.update(lessonProgress).set({ status: "available", updatedAt: now })
      .where(and(eq(lessonProgress.enrollmentId, enrollmentId), inArray(lessonProgress.lessonId, unlockIds)));
  }
  return { unlocked: unlockIds.length };
}

export async function refreshAllActiveEnrollments() {
  const active = await db.select({ id: enrollments.id }).from(enrollments).where(eq(enrollments.status, "active"));
  let unlocked = 0;
  for (const enrollment of active) {
    unlocked += (await refreshEnrollmentProgress(enrollment.id)).unlocked;
  }
  return { enrollments: active.length, unlocked };
}

export async function recalculateEnrollmentSchedule(enrollmentId: string) {
  const [context] = await db.select({
    assignedStartDate: enrollments.assignedStartDate,
    timezone: enrollments.timezone,
    classDays: programs.classDays,
  }).from(enrollments)
    .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .innerJoin(programs, eq(programs.id, cohorts.programId))
    .where(eq(enrollments.id, enrollmentId))
    .limit(1);
  if (!context) throw new ApiError("Enrolment not found.", 404);

  const records = await db.select({
    lessonId: lessonProgress.lessonId,
    status: lessonProgress.status,
    releaseOffset: lessons.releaseOffset,
  }).from(lessonProgress)
    .innerJoin(lessons, eq(lessons.id, lessonProgress.lessonId))
    .innerJoin(phases, eq(phases.id, lessons.phaseId))
    .where(and(eq(lessonProgress.enrollmentId, enrollmentId), eq(lessons.status, "published")))
    .orderBy(asc(lessons.releaseOffset), asc(phases.position), asc(lessons.position));

  let prerequisitePassed = true;
  const now = new Date();
  await db.transaction(async (tx) => {
    for (const record of records) {
      const window = lessonWindow(
        context.assignedStartDate,
        record.releaseOffset,
        context.timezone,
        context.classDays,
      );
      const preservesWork = ["passed", "submitted", "changes_requested", "in_progress"].includes(record.status);
      const status = preservesWork
        ? record.status
        : prerequisitePassed && now >= window.availableAt
          ? "available" as const
          : "locked" as const;
      await tx.update(lessonProgress).set({
        availableAt: window.availableAt,
        dueAt: window.dueAt,
        status,
        updatedAt: now,
      }).where(and(
        eq(lessonProgress.enrollmentId, enrollmentId),
        eq(lessonProgress.lessonId, record.lessonId),
      ));
      prerequisitePassed = record.status === "passed";
    }
  });
}

export async function syncProgramEnrollmentSchedules(programId: string) {
  const rows = await db.select({
    id: enrollments.id,
    cohortId: enrollments.cohortId,
    assignedStartDate: enrollments.assignedStartDate,
    timezone: enrollments.timezone,
  }).from(enrollments)
    .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .where(and(eq(cohorts.programId, programId), inArray(enrollments.status, ["active", "complete"])));

  for (const enrollment of rows) {
    await initializeEnrollmentProgress({
      enrollmentId: enrollment.id,
      cohortId: enrollment.cohortId,
      assignedStartDate: enrollment.assignedStartDate,
      timezone: enrollment.timezone,
    });
    await recalculateEnrollmentSchedule(enrollment.id);
    await refreshEnrollmentProgress(enrollment.id);
    const progress = await db.select({ status: lessonProgress.status }).from(lessonProgress)
      .innerJoin(lessons, eq(lessons.id, lessonProgress.lessonId))
      .where(and(eq(lessonProgress.enrollmentId, enrollment.id), eq(lessons.status, "published")));
    const passed = progress.filter((lesson) => lesson.status === "passed").length;
    const complete = progress.length > 0 && passed === progress.length;
    await db.update(enrollments).set({
      progressPercent: progress.length ? Math.round((passed / progress.length) * 100) : 0,
      status: complete ? "complete" : "active",
      completedAt: complete ? new Date() : null,
      updatedAt: new Date(),
    }).where(eq(enrollments.id, enrollment.id));
  }

  return { enrollments: rows.length };
}
