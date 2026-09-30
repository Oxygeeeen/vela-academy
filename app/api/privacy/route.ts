import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { consentRecords, enrollments, notifications, reviews, submissions, supportMessages, supportTickets, users } from "@/db/schema";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security";

const consentSchema = z.object({
  policy: z.enum(["privacy", "acceptable_use", "learning_analytics"]),
  version: z.string().min(1).max(40),
});

export async function GET() {
  try {
    const actor = await requireUser();
    const [profile, enrolmentRows, submissionRows, notificationRows, ticketRows, consentRows] = await Promise.all([
      db.select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        timezone: users.timezone,
        locale: users.locale,
        status: users.status,
        createdAt: users.createdAt,
      }).from(users).where(eq(users.id, actor.id)).limit(1),
      db.select().from(enrollments).where(eq(enrollments.userId, actor.id)),
      db.select({ submission: submissions, review: reviews }).from(submissions)
        .innerJoin(enrollments, eq(enrollments.id, submissions.enrollmentId))
        .leftJoin(reviews, eq(reviews.submissionId, submissions.id))
        .where(eq(enrollments.userId, actor.id)),
      db.select().from(notifications).where(eq(notifications.userId, actor.id)),
      db.select({ ticket: supportTickets, message: supportMessages }).from(supportTickets)
        .leftJoin(supportMessages, eq(supportMessages.ticketId, supportTickets.id))
        .where(eq(supportTickets.requesterId, actor.id)),
      db.select().from(consentRecords).where(eq(consentRecords.userId, actor.id)),
    ]);
    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      profile: profile[0],
      enrollments: enrolmentRows,
      submissions: submissionRows,
      notifications: notificationRows,
      support: ticketRows,
      consents: consentRows,
    }, {
      headers: {
        "content-disposition": `attachment; filename="vela-data-export-${new Date().toISOString().slice(0, 10)}.json"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    const actor = await requireUser();
    const input = consentSchema.parse(await request.json());
    await db.insert(consentRecords).values({
      userId: actor.id,
      policy: input.policy,
      version: input.version,
    }).onConflictDoNothing();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
