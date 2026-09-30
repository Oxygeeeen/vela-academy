import { NextResponse } from "next/server";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { assessments, enrollments, lessonProgress, lessons, reviews, submissions, users } from "@/db/schema";
import { apiError, ApiError, paginationFrom } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security";
import { createNotifications } from "@/lib/notifications";
import { writeAuditEvent } from "@/lib/audit";

const schema = z.object({
  lessonId: z.string().uuid(),
  responseText: z.string().trim().max(50_000).optional(),
  answers: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(request: Request) {
  try {
    const actor = await requireUser();
    const { page, pageSize, offset } = paginationFrom(request.url);
    const conditions = and(eq(enrollments.userId, actor.id), eq(submissions.organizationId, actor.organizationId));
    const [rows, total] = await Promise.all([
      db.select({
        id: submissions.id,
        lessonId: submissions.lessonId,
        lessonTitle: lessons.title,
        attempt: submissions.attempt,
        responseText: submissions.responseText,
        score: submissions.score,
        status: submissions.status,
        submittedAt: submissions.submittedAt,
        reviewedAt: submissions.reviewedAt,
        feedback: reviews.feedback,
      }).from(submissions)
        .innerJoin(enrollments, eq(enrollments.id, submissions.enrollmentId))
        .innerJoin(lessons, eq(lessons.id, submissions.lessonId))
        .leftJoin(reviews, eq(reviews.submissionId, submissions.id))
        .where(conditions)
        .orderBy(desc(submissions.createdAt))
        .limit(pageSize).offset(offset),
      db.select({ value: count() }).from(submissions)
        .innerJoin(enrollments, eq(enrollments.id, submissions.enrollmentId))
        .where(conditions),
    ]);
    return NextResponse.json({ data: rows, pagination: { page, pageSize, total: total[0]?.value ?? 0 } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    const actor = await requireUser();
    const input = schema.parse(await request.json());
    if (!input.responseText && !input.answers) throw new ApiError("Add a written response or assessment answers.");

    const [context] = await db.select({
      enrollmentId: enrollments.id,
      enrollmentStatus: enrollments.status,
      progressStatus: lessonProgress.status,
      lectureCompletedAt: lessonProgress.lectureCompletedAt,
      assessmentId: assessments.id,
      maximumAttempts: lessons.maximumAttempts,
      lessonTitle: lessons.title,
    }).from(enrollments)
      .innerJoin(lessonProgress, eq(lessonProgress.enrollmentId, enrollments.id))
      .innerJoin(lessons, eq(lessons.id, lessonProgress.lessonId))
      .innerJoin(assessments, eq(assessments.lessonId, lessons.id))
      .where(and(
        eq(enrollments.userId, actor.id),
        eq(enrollments.organizationId, actor.organizationId),
        eq(lessons.id, input.lessonId),
      )).limit(1);
    if (!context) throw new ApiError("Assessment not found.", 404);
    if (context.enrollmentStatus !== "active") throw new ApiError("Your enrolment is not active.", 403);
    if (!["in_progress", "changes_requested", "available"].includes(context.progressStatus)) {
      throw new ApiError("This assessment is not currently available.", 403);
    }
    if (!context.lectureCompletedAt) throw new ApiError("Complete the lecture before submitting the assessment.");

    const [attempts] = await db.select({ value: count() }).from(submissions)
      .where(and(eq(submissions.enrollmentId, context.enrollmentId), eq(submissions.lessonId, input.lessonId)));
    const attempt = (attempts?.value ?? 0) + 1;
    if (attempt > context.maximumAttempts) throw new ApiError("Maximum attempts reached. Contact support for assistance.", 403);

    const [submission] = await db.transaction(async (tx) => {
      const created = await tx.insert(submissions).values({
        organizationId: actor.organizationId,
        enrollmentId: context.enrollmentId,
        lessonId: input.lessonId,
        assessmentId: context.assessmentId,
        attempt,
        responseText: input.responseText,
        answers: input.answers,
        status: "submitted",
        submittedAt: new Date(),
      }).returning();
      await tx.update(lessonProgress).set({ status: "submitted", updatedAt: new Date() })
        .where(and(eq(lessonProgress.enrollmentId, context.enrollmentId), eq(lessonProgress.lessonId, input.lessonId)));
      return created;
    });

    const reviewers = await db.select({ id: users.id }).from(users).where(and(
      eq(users.organizationId, actor.organizationId),
      eq(users.status, "active"),
      inArray(users.role, ["owner", "admin", "reviewer"]),
    ));
    await createNotifications(reviewers.map((reviewer) => ({
      organizationId: actor.organizationId,
      userId: reviewer.id,
      kind: "submission_ready",
      title: "Submission ready for review",
      body: `${actor.fullName} submitted ${context.lessonTitle} (attempt ${attempt}).`,
      actionUrl: "/?view=reviews",
    })));
    await writeAuditEvent({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: "assessment.submitted",
      entityType: "submission",
      entityId: submission.id,
      metadata: { lessonId: input.lessonId, attempt },
    });
    return NextResponse.json({ data: submission }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
