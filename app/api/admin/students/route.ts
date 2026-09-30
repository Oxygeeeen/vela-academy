import { NextResponse } from "next/server";
import { and, asc, count, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { cohorts, enrollments, users } from "@/db/schema";
import { apiError, ApiError, normalizeEmail, paginationFrom } from "@/lib/api";
import { generateTemporaryPassword, hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { requireRole } from "@/lib/auth/session";
import { writeAuditEvent } from "@/lib/audit";
import { initializeEnrollmentProgress } from "@/lib/enrollment";
import { isValidTimezone } from "@/lib/schedule";
import { assertSameOrigin } from "@/lib/security";
import { queueEmail } from "@/lib/email";

const createSchema = z.object({
  email: z.string().email().max(320),
  fullName: z.string().trim().min(2).max(160),
  role: z.enum(["student", "trainer", "reviewer"]).default("student"),
  timezone: z.string().min(1).max(80),
  cohortId: z.string().uuid(),
  assignedStartDate: z.string().date(),
  password: z.string().max(256).optional(),
  sendWelcomeEmail: z.boolean().default(true),
});

export async function GET(request: Request) {
  try {
    const actor = await requireRole(["owner", "admin", "reviewer", "trainer"]);
    const { page, pageSize, offset } = paginationFrom(request.url);
    const params = new URL(request.url).searchParams;
    const search = params.get("q")?.trim();
    const status = params.get("status");
    const cohortId = params.get("cohortId");
    const filters = [eq(users.organizationId, actor.organizationId), eq(users.role, "student" as const)];
    if (search) filters.push(or(ilike(users.fullName, `%${search}%`), ilike(users.email, `%${search}%`))!);
    if (status) filters.push(eq(users.status, status as "active"));
    if (cohortId) filters.push(eq(enrollments.cohortId, cohortId));

    const [rows, totalRows] = await Promise.all([
      db.select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        timezone: users.timezone,
        status: users.status,
        lastLoginAt: users.lastLoginAt,
        enrollmentId: enrollments.id,
        enrollmentStatus: enrollments.status,
        progressPercent: enrollments.progressPercent,
        assignedStartDate: enrollments.assignedStartDate,
        cohortId: cohorts.id,
        cohortName: cohorts.name,
      }).from(users)
        .leftJoin(enrollments, eq(enrollments.userId, users.id))
        .leftJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
        .where(and(...filters))
        .orderBy(desc(users.createdAt), asc(users.fullName))
        .limit(pageSize)
        .offset(offset),
      db.select({ value: count() }).from(users)
        .leftJoin(enrollments, eq(enrollments.userId, users.id))
        .where(and(...filters)),
    ]);
    return NextResponse.json({ data: rows, pagination: { page, pageSize, total: totalRows[0]?.value ?? 0 } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    const actor = await requireRole(["owner", "admin"]);
    const input = createSchema.parse(await request.json());
    if (!isValidTimezone(input.timezone)) throw new ApiError("Select a valid IANA timezone.");
    const email = normalizeEmail(input.email);
    const temporaryPassword = input.password ?? generateTemporaryPassword();
    const strength = validatePasswordStrength(temporaryPassword);
    if (!strength.valid) throw new ApiError(strength.message ?? "Password is not strong enough.");

    const [cohort] = await db.select({ id: cohorts.id }).from(cohorts)
      .where(and(eq(cohorts.id, input.cohortId), eq(cohorts.organizationId, actor.organizationId))).limit(1);
    if (!cohort) throw new ApiError("Cohort not found.", 404);

    const result = await db.transaction(async (tx) => {
      const existing = await tx.select({ id: users.id, role: users.role, sessionVersion: users.sessionVersion }).from(users)
        .where(and(eq(users.organizationId, actor.organizationId), eq(users.email, email))).limit(1);
      let user: typeof users.$inferSelect;
      if (existing.length) {
        if (existing[0].role !== "student") throw new ApiError("This email belongs to a non-student account.", 409);
        const activeEnrollment = await tx.select({ id: enrollments.id }).from(enrollments)
          .where(and(eq(enrollments.userId, existing[0].id), eq(enrollments.status, "active"))).limit(1);
        if (activeEnrollment.length) throw new ApiError("This learner already has an active enrolment.", 409);
        [user] = await tx.update(users).set({
          fullName: input.fullName,
          passwordHash: await hashPassword(temporaryPassword),
          timezone: input.timezone,
          status: "active",
          mustChangePassword: true,
          sessionVersion: existing[0].sessionVersion + 1,
          updatedAt: new Date(),
        }).where(eq(users.id, existing[0].id)).returning();
      } else {
        [user] = await tx.insert(users).values({
          organizationId: actor.organizationId,
          email,
          fullName: input.fullName,
          passwordHash: await hashPassword(temporaryPassword),
          role: input.role,
          timezone: input.timezone,
          status: "active",
          mustChangePassword: true,
        }).returning();
      }
      const [enrollment] = await tx.insert(enrollments).values({
        organizationId: actor.organizationId,
        userId: user.id,
        cohortId: input.cohortId,
        assignedStartDate: input.assignedStartDate,
        timezone: input.timezone,
        enrolledBy: actor.id,
      }).returning();
      return { user, enrollment };
    });
    await initializeEnrollmentProgress({
      enrollmentId: result.enrollment.id,
      cohortId: input.cohortId,
      assignedStartDate: input.assignedStartDate,
      timezone: input.timezone,
    });
    if (input.sendWelcomeEmail) {
      await queueEmail({
        organizationId: actor.organizationId,
        to: email,
        subject: "Welcome to Vela AI Academy",
        template: "learner_welcome",
        payload: {
          heading: "Your learning journey is ready",
          message: `You have been enrolled with a start date of ${input.assignedStartDate}. Sign in with the temporary password supplied by your administrator.`,
          actionUrl: process.env.APP_URL,
        },
      });
    }
    await writeAuditEvent({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: "student.enrolled",
      entityType: "user",
      entityId: result.user.id,
      metadata: { cohortId: input.cohortId, assignedStartDate: input.assignedStartDate },
    });
    return NextResponse.json({
      student: { id: result.user.id, email, fullName: result.user.fullName },
      temporaryPassword: input.password ? undefined : temporaryPassword,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "23505") {
      return NextResponse.json({ error: "This learner is already enrolled." }, { status: 409 });
    }
    return apiError(error);
  }
}
