import { NextResponse } from "next/server";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { certificates, enrollments, lessonProgress, lessons, reviews, submissions, users } from "@/db/schema";
import { apiError, ApiError } from "@/lib/api";
import { requireRole } from "@/lib/auth/session";
import { writeAuditEvent } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/security";
import { createNotification } from "@/lib/notifications";
import { refreshEnrollmentProgress } from "@/lib/enrollment";
import { queueEmail } from "@/lib/email";

const schema = z.object({
  decision: z.enum(["passed", "changes_requested"]),
  score: z.number().int().min(0).max(100),
  feedback: z.string().trim().min(10).max(20_000),
  rubricScores: z.record(z.string(), z.number().min(0).max(100)).default({}),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await assertSameOrigin();
    const actor = await requireRole(["owner", "admin", "reviewer"]);
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    const [record] = await db.select({
      id: submissions.id,
      organizationId: submissions.organizationId,
      enrollmentId: submissions.enrollmentId,
      lessonId: submissions.lessonId,
      status: submissions.status,
      passMark: lessons.passMark,
      lessonTitle: lessons.title,
      studentId: users.id,
      studentName: users.fullName,
      studentEmail: users.email,
    }).from(submissions)
      .innerJoin(lessons, eq(lessons.id, submissions.lessonId))
      .innerJoin(enrollments, eq(enrollments.id, submissions.enrollmentId))
      .innerJoin(users, eq(users.id, enrollments.userId))
      .where(and(eq(submissions.id, id), eq(submissions.organizationId, actor.organizationId))).limit(1);
    if (!record) throw new ApiError("Submission not found.", 404);
    if (!["submitted", "in_review"].includes(record.status)) throw new ApiError("This submission has already been reviewed.", 409);
    if (input.decision === "passed" && input.score < record.passMark) {
      throw new ApiError(`A passing decision requires at least ${record.passMark}%.`);
    }

    await db.transaction(async (tx) => {
      await tx.insert(reviews).values({
        submissionId: id,
        reviewerId: actor.id,
        decision: input.decision,
        score: input.score,
        feedback: input.feedback,
        rubricScores: input.rubricScores,
      });
      await tx.update(submissions).set({
        status: input.decision,
        score: input.score,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(submissions.id, id));
      await tx.update(lessonProgress).set({
        status: input.decision,
        passedAt: input.decision === "passed" ? new Date() : null,
        updatedAt: new Date(),
      }).where(and(
        eq(lessonProgress.enrollmentId, record.enrollmentId),
        eq(lessonProgress.lessonId, record.lessonId),
      ));
    });

    const [progressCount] = await db.select({
      total: count(),
      passed: count(lessonProgress.passedAt),
    }).from(lessonProgress).where(eq(lessonProgress.enrollmentId, record.enrollmentId));
    const total = progressCount?.total ?? 0;
    const passed = progressCount?.passed ?? 0;
    const progressPercent = total ? Math.round((passed / total) * 100) : 0;
    const complete = total > 0 && passed === total;
    await db.update(enrollments).set({
      progressPercent,
      status: complete ? "complete" : "active",
      completedAt: complete ? new Date() : null,
      updatedAt: new Date(),
    }).where(eq(enrollments.id, record.enrollmentId));

    let certificateCode: string | undefined;
    if (complete) {
      certificateCode = `VELA-${crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;
      const [certificate] = await db.insert(certificates).values({
        organizationId: actor.organizationId,
        enrollmentId: record.enrollmentId,
        verificationCode: certificateCode,
        metadata: { issuedFor: record.studentName, programme: "Enterprise AI Trainer" },
      }).onConflictDoNothing().returning({ verificationCode: certificates.verificationCode });
      certificateCode = certificate?.verificationCode;
    } else if (input.decision === "passed") {
      await refreshEnrollmentProgress(record.enrollmentId);
    }

    await createNotification({
      organizationId: actor.organizationId,
      userId: record.studentId,
      kind: input.decision === "passed" ? "assessment_passed" : "changes_requested",
      title: input.decision === "passed" ? "Assessment passed" : "Changes requested",
      body: `${record.lessonTitle}: ${input.score}%. ${input.feedback.slice(0, 240)}`,
      actionUrl: "/?view=curriculum",
    });
    await queueEmail({
      organizationId: actor.organizationId,
      to: record.studentEmail,
      subject: input.decision === "passed" ? "Assessment passed" : "Assessment feedback is ready",
      template: "assessment_reviewed",
      payload: {
        heading: input.decision === "passed" ? "You passed your assessment" : "Your reviewer left feedback",
        message: `${record.lessonTitle}: ${input.score}%. ${input.feedback}`,
        actionUrl: process.env.APP_URL,
      },
    });
    await writeAuditEvent({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: `review.${input.decision}`,
      entityType: "submission",
      entityId: id,
      metadata: { score: input.score, certificateCode },
    });
    return NextResponse.json({ ok: true, progressPercent, complete, certificateCode });
  } catch (error) {
    return apiError(error);
  }
}
