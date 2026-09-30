import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { apiError, ApiError } from "@/lib/api";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/auth/password";
import { clearSession, requireUser } from "@/lib/auth/session";
import { writeAuditEvent } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/security";

const schema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(1).max(256),
});

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    const actor = await requireUser();
    const body = schema.parse(await request.json());
    const strength = validatePasswordStrength(body.newPassword);
    if (!strength.valid) throw new ApiError(strength.message ?? "Password is not strong enough.");

    const [record] = await db.select({ passwordHash: users.passwordHash, sessionVersion: users.sessionVersion })
      .from(users).where(eq(users.id, actor.id)).limit(1);
    if (!record || !(await verifyPassword(body.currentPassword, record.passwordHash))) {
      throw new ApiError("Current password is incorrect.", 401);
    }

    await db.update(users).set({
      passwordHash: await hashPassword(body.newPassword),
      mustChangePassword: false,
      sessionVersion: record.sessionVersion + 1,
      updatedAt: new Date(),
    }).where(eq(users.id, actor.id));
    await writeAuditEvent({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: "user.password_changed",
      entityType: "user",
      entityId: actor.id,
    });
    await clearSession();
    return NextResponse.json({ ok: true, signInRequired: true });
  } catch (error) {
    return apiError(error);
  }
}
