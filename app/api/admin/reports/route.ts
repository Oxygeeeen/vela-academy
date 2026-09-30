import { NextResponse } from "next/server";
import { and, avg, count, eq, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { certificates, enrollments, lessonProgress, reviews, submissions } from "@/db/schema";
import { apiError } from "@/lib/api";
import { requireRole } from "@/lib/auth/session";

export async function GET() {
  try {
    const actor = await requireRole(["owner", "admin", "reviewer", "trainer"]);
    const org = eq(enrollments.organizationId, actor.organizationId);
    const [learnerMetrics, reviewMetrics, overdueMetrics, certificateMetrics, cohortProgress] = await Promise.all([
      db.select({
        total: count(),
        active: sql<number>`count(*) filter (where ${enrollments.status} = 'active')`,
        completed: sql<number>`count(*) filter (where ${enrollments.status} = 'complete')`,
        averageProgress: avg(enrollments.progressPercent),
      }).from(enrollments).where(org),
      db.select({
        pending: sql<number>`count(*) filter (where ${submissions.status} in ('submitted','in_review'))`,
        reviewed: count(reviews.id),
        averageScore: avg(submissions.score),
      }).from(submissions)
        .leftJoin(reviews, eq(reviews.submissionId, submissions.id))
        .where(eq(submissions.organizationId, actor.organizationId)),
      db.select({ value: count() }).from(lessonProgress)
        .innerJoin(enrollments, eq(enrollments.id, lessonProgress.enrollmentId))
        .where(and(org, lt(lessonProgress.dueAt, new Date()), isNull(lessonProgress.passedAt))),
      db.select({ value: count() }).from(certificates)
        .where(and(eq(certificates.organizationId, actor.organizationId), isNull(certificates.revokedAt))),
      db.select({
        status: enrollments.status,
        learners: count(),
        averageProgress: avg(enrollments.progressPercent),
      }).from(enrollments).where(org).groupBy(enrollments.status),
    ]);
    const learner = learnerMetrics[0] ?? { total: 0, active: 0, completed: 0, averageProgress: 0 };
    return NextResponse.json({
      metrics: {
        learners: Number(learner.total ?? 0),
        activeLearners: Number(learner.active ?? 0),
        completions: Number(learner.completed ?? 0),
        completionRate: Number(learner.total) ? Math.round((Number(learner.completed) / Number(learner.total)) * 100) : 0,
        averageProgress: Math.round(Number(learner.averageProgress ?? 0)),
        pendingReviews: Number(reviewMetrics[0]?.pending ?? 0),
        averageScore: Math.round(Number(reviewMetrics[0]?.averageScore ?? 0)),
        overdueLessons: Number(overdueMetrics[0]?.value ?? 0),
        certificatesIssued: Number(certificateMetrics[0]?.value ?? 0),
      },
      cohortProgress,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return apiError(error);
  }
}
