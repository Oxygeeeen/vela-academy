import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { passwordResetTokens, users } from "@/db/schema";
import { apiError, ApiError } from "@/lib/api";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { hashPasswordResetToken } from "@/lib/auth/reset-token";
import { clearSession } from "@/lib/auth/session";
import { writeAuditEvent } from "@/lib/audit";
import { queueAndDeliverEmail } from "@/lib/email";
import { assertRateLimit } from "@/lib/rate-limit";
import { assertSameOrigin } from "@/lib/security";

const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/i, "The password reset link is invalid.");
const resetSchema = z.object({
  token: tokenSchema,
  newPassword: z.string().min(1).max(256),
});

async function findValidToken(token: string) {
  const [record] = await db.select({
    id: passwordResetTokens.id,
    userId: passwordResetTokens.userId,
    organizationId: passwordResetTokens.organizationId,
    email: users.email,
    fullName: users.fullName,
    sessionVersion: users.sessionVersion,
  }).from(passwordResetTokens)
    .innerJoin(users, eq(users.id, passwordResetTokens.userId))
    .where(and(
      eq(passwordResetTokens.tokenHash, hashPasswordResetToken(token)),
      isNull(passwordResetTokens.usedAt),
      gt(passwordResetTokens.expiresAt, new Date()),
      eq(users.status, "active"),
    ))
    .limit(1);
  return record;
}

export async function GET(request: Request) {
  try {
    const token = tokenSchema.parse(new URL(request.url).searchParams.get("token"));
    const record = await findValidToken(token);
    if (!record) throw new ApiError("This password reset link is invalid or has expired.", 410);
    return NextResponse.json({ valid: true, emailHint: record.email.replace(/(^.).*(@.*$)/, "$1••••$2") });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    const requestHeaders = await headers();
    const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    await assertRateLimit(`password-reset-complete:${ip}`, 10, 3600);
    const input = resetSchema.parse(await request.json());
    const strength = validatePasswordStrength(input.newPassword);
    if (!strength.valid) throw new ApiError(strength.message ?? "Password is not strong enough.");
    const record = await findValidToken(input.token);
    if (!record) throw new ApiError("This password reset link is invalid or has expired.", 410);

    await db.transaction(async (tx) => {
      const used = await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(and(
        eq(passwordResetTokens.id, record.id),
        isNull(passwordResetTokens.usedAt),
      )).returning({ id: passwordResetTokens.id });
      if (!used.length) throw new ApiError("This password reset link has already been used.", 410);
      await tx.update(users).set({
        passwordHash: await hashPassword(input.newPassword),
        mustChangePassword: false,
        sessionVersion: record.sessionVersion + 1,
        failedLoginCount: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      }).where(eq(users.id, record.userId));
      await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(and(
        eq(passwordResetTokens.userId, record.userId),
        isNull(passwordResetTokens.usedAt),
      ));
    });

    await clearSession();
    await queueAndDeliverEmail({
      organizationId: record.organizationId,
      to: record.email,
      subject: "Your Vela Academy password was changed",
      template: "password_reset_confirmed",
      payload: {
        heading: "Password changed successfully",
        message: `Hello ${record.fullName}. Your Vela Academy password has been changed and all existing sessions have been signed out. If you did not make this change, contact vela@scaleworkagency.com immediately.`,
        actionUrl: process.env.APP_URL,
        actionLabel: "Return to Vela Academy",
      },
    });
    await writeAuditEvent({
      organizationId: record.organizationId,
      actorId: record.userId,
      action: "user.password_reset_completed",
      entityType: "user",
      entityId: record.userId,
    });
    return NextResponse.json({ ok: true, message: "Your password has been changed. A confirmation email has been sent." });
  } catch (error) {
    return apiError(error);
  }
}
