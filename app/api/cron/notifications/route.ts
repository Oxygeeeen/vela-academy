import { NextResponse } from "next/server";
import { and, eq, gt, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { enrollments, lessonProgress, lessons, notifications, users } from "@/db/schema";
import { apiError } from "@/lib/api";
import { deliverPendingEmails, queueEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications";
import { clearExpiredRateLimits } from "@/lib/rate-limit";
import { verifyCronAuthorization } from "@/lib/security";

export async function GET(request: Request) {
  try {
    verifyCronAuthorization(request.headers.get("authorization"));
    const now = new Date();
    const horizon = new Date(now.getTime() + 24 * 60 * 60_000);
    const dueSoon = await db.select({
      userId: users.id,
      email: users.email,
      organizationId: users.organizationId,
      lessonId: lessons.id,
      lessonTitle: lessons.title,
      dueAt: lessonProgress.dueAt,
    }).from(lessonProgress)
      .innerJoin(enrollments, eq(enrollments.id, lessonProgress.enrollmentId))
      .innerJoin(users, eq(users.id, enrollments.userId))
      .innerJoin(lessons, eq(lessons.id, lessonProgress.lessonId))
      .where(and(
        eq(enrollments.status, "active"),
        inArray(lessonProgress.status, ["available", "in_progress", "changes_requested"]),
        gt(lessonProgress.dueAt, now),
        lte(lessonProgress.dueAt, horizon),
      ));

    let reminders = 0;
    for (const item of dueSoon) {
      const reminderKey = `deadline_24h:${item.lessonId}:${item.dueAt?.toISOString().slice(0, 10)}`;
      const [existing] = await db.select({ id: notifications.id }).from(notifications).where(and(
        eq(notifications.userId, item.userId),
        eq(notifications.kind, reminderKey),
      )).limit(1);
      if (existing) continue;
      await createNotification({
        organizationId: item.organizationId,
        userId: item.userId,
        kind: reminderKey,
        title: "Assessment deadline approaching",
        body: `${item.lessonTitle} is due within 24 hours.`,
        actionUrl: `/?lesson=${item.lessonId}`,
      });
      await queueEmail({
        organizationId: item.organizationId,
        to: item.email,
        subject: `Due soon: ${item.lessonTitle}`,
        template: "deadline_reminder",
        payload: {
          heading: "Your assessment is due soon",
          message: `${item.lessonTitle} is due within 24 hours.`,
          actionUrl: process.env.APP_URL,
        },
      });
      reminders += 1;
    }
    const email = await deliverPendingEmails();
    await clearExpiredRateLimits();
    return NextResponse.json({ ok: true, reminders, email, ranAt: now.toISOString() });
  } catch (error) {
    return apiError(error);
  }
}
