import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { enrollments, users } from "@/db/schema";
import { apiError, ApiError } from "@/lib/api";
import { generateTemporaryPassword, hashPassword } from "@/lib/auth/password";
import { requireRole } from "@/lib/auth/session";
import { writeAuditEvent } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/security";
import { isValidTimezone } from "@/lib/schedule";
import { recalculateEnrollmentSchedule } from "@/lib/enrollment";

const updateSchema = z.object({
  fullName: z.string().trim().min(2).max(160).optional(),
  timezone: z.string().min(1).max(80).optional(),
  userStatus: z.enum(["active", "suspended"]).optional(),
  enrollmentStatus: z.enum(["active", "paused", "withdrawn"]).optional(),
  assignedStartDate: z.string().date().optional(),
  action: z.enum(["reset_password", "revoke_sessions"]).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await assertSameOrigin();
    const actor = await requireRole(["owner", "admin"]);
    const { id } = await context.params;
    const input = updateSchema.parse(await request.json());
    if (input.timezone && !isValidTimezone(input.timezone)) throw new ApiError("Select a valid IANA timezone.");

    const [student] = await db.select({ id: users.id, sessionVersion: users.sessionVersion })
      .from(users)
      .where(and(eq(users.id, id), eq(users.organizationId, actor.organizationId)))
      .limit(1);
    if (!student) throw new ApiError("Student not found.", 404);

    let temporaryPassword: string | undefined;
    const userUpdate: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
    if (input.fullName) userUpdate.fullName = input.fullName;
    if (input.timezone) userUpdate.timezone = input.timezone;
    if (input.userStatus) userUpdate.status = input.userStatus;
    if (input.action === "reset_password") {
      temporaryPassword = generateTemporaryPassword();
      userUpdate.passwordHash = await hashPassword(temporaryPassword);
      userUpdate.mustChangePassword = true;
      userUpdate.sessionVersion = student.sessionVersion + 1;
    } else if (input.action === "revoke_sessions") {
      userUpdate.sessionVersion = student.sessionVersion + 1;
    }
    await db.update(users).set(userUpdate).where(eq(users.id, id));

    const enrollmentUpdate: Partial<typeof enrollments.$inferInsert> = { updatedAt: new Date() };
    if (input.enrollmentStatus) enrollmentUpdate.status = input.enrollmentStatus;
    if (input.assignedStartDate) enrollmentUpdate.assignedStartDate = input.assignedStartDate;
    if (input.timezone) enrollmentUpdate.timezone = input.timezone;
    if (Object.keys(enrollmentUpdate).length > 1) {
      await db.update(enrollments).set(enrollmentUpdate)
        .where(and(eq(enrollments.userId, id), eq(enrollments.organizationId, actor.organizationId)));
      if (input.assignedStartDate || input.timezone) {
        const affected = await db.select({ id: enrollments.id }).from(enrollments).where(and(
          eq(enrollments.userId, id),
          eq(enrollments.organizationId, actor.organizationId),
        ));
        for (const enrollment of affected) await recalculateEnrollmentSchedule(enrollment.id);
      }
    }

    await writeAuditEvent({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: input.action ? `student.${input.action}` : "student.updated",
      entityType: "user",
      entityId: id,
      metadata: { fields: Object.keys(input) },
    });
    return NextResponse.json({ ok: true, temporaryPassword });
  } catch (error) {
    return apiError(error);
  }
}
