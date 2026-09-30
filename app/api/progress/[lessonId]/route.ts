import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { enrollments, lessonProgress } from "@/db/schema";
import { apiError, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security";

const schema = z.object({
  action: z.enum(["start", "heartbeat", "complete_lecture"]),
  playbackSeconds: z.number().int().min(0).max(100_000).optional(),
  percentViewed: z.number().int().min(0).max(100).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ lessonId: string }> }) {
  try {
    await assertSameOrigin();
    const actor = await requireUser();
    const { lessonId } = await context.params;
    const input = schema.parse(await request.json());
    const [record] = await db.select({
      enrollmentId: enrollments.id,
      enrollmentStatus: enrollments.status,
      lessonStatus: lessonProgress.status,
      startedAt: lessonProgress.startedAt,
      playbackSeconds: lessonProgress.playbackSeconds,
      percentViewed: lessonProgress.percentViewed,
    }).from(enrollments)
      .innerJoin(lessonProgress, eq(lessonProgress.enrollmentId, enrollments.id))
      .where(and(
        eq(enrollments.userId, actor.id),
        eq(enrollments.organizationId, actor.organizationId),
        eq(lessonProgress.lessonId, lessonId),
      )).limit(1);
    if (!record) throw new ApiError("Lesson progress was not found.", 404);
    if (record.enrollmentStatus !== "active") throw new ApiError("Your enrolment is not currently active.", 403);
    if (record.lessonStatus === "locked") throw new ApiError("Complete the prerequisite and wait for the scheduled release.", 403);

    const nextViewed = Math.max(record.percentViewed, input.percentViewed ?? 0);
    const nextPlayback = Math.max(record.playbackSeconds, input.playbackSeconds ?? 0);
    if (input.action === "complete_lecture" && nextViewed < 80) {
      throw new ApiError("At least 80% of the lecture must be completed before assessment submission.");
    }
    await db.update(lessonProgress).set({
      status: record.lessonStatus === "available" ? "in_progress" : record.lessonStatus,
      startedAt: record.startedAt ?? new Date(),
      playbackSeconds: nextPlayback,
      percentViewed: nextViewed,
      lectureCompletedAt: input.action === "complete_lecture" ? new Date() : undefined,
      updatedAt: new Date(),
    }).where(and(eq(lessonProgress.enrollmentId, record.enrollmentId), eq(lessonProgress.lessonId, lessonId)));
    return NextResponse.json({ ok: true, percentViewed: nextViewed, playbackSeconds: nextPlayback });
  } catch (error) {
    return apiError(error);
  }
}
