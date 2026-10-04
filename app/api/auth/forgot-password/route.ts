import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { passwordResetTokens, users } from "@/db/schema";
import { apiError, normalizeEmail } from "@/lib/api";
import { createPasswordResetToken, hashPasswordResetToken } from "@/lib/auth/reset-token";
import { writeAuditEvent } from "@/lib/audit";
import { queueAndDeliverEmail } from "@/lib/email";
import { getOptionalEnv } from "@/lib/env";
import { assertRateLimit } from "@/lib/rate-limit";
import { assertSameOrigin } from "@/lib/security";

const schema = z.object({ email: z.string().email().max(320) });
const responseMessage = "If an active account matches that email, password reset instructions have been sent.";

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    const requestHeaders = await headers();
    const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const { email: suppliedEmail } = schema.parse(await request.json());
    const email = normalizeEmail(suppliedEmail);
    await assertRateLimit(`password-reset-ip:${ip}`, 8, 900);
    await assertRateLimit(`password-reset-email:${hashPasswordResetToken(email)}`, 3, 3600);

    const matches = await db.select({
      id: users.id,
      organizationId: users.organizationId,
      email: users.email,
      fullName: users.fullName,
    }).from(users).where(and(eq(users.email, email), eq(users.status, "active")));

    const appUrl = (getOptionalEnv().APP_URL ?? new URL(request.url).origin).replace(/\/$/, "");
    for (const user of matches) {
      const token = createPasswordResetToken();
      const tokenHash = hashPasswordResetToken(token);
      const expiresAt = new Date(Date.now() + 60 * 60_000);
      await db.transaction(async (tx) => {
        await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(and(
          eq(passwordResetTokens.userId, user.id),
          isNull(passwordResetTokens.usedAt),
        ));
        await tx.insert(passwordResetTokens).values({
          organizationId: user.organizationId,
          userId: user.id,
          tokenHash,
          expiresAt,
        });
      });
      await queueAndDeliverEmail({
        organizationId: user.organizationId,
        to: user.email,
        subject: "Reset your Vela Academy password",
        template: "password_reset_requested",
        payload: {
          heading: "Reset your password",
          message: `Hello ${user.fullName}. We received a request to reset your Vela Academy password. This secure link expires in 60 minutes and can be used once. If you did not request this, you can safely ignore this email.`,
          actionUrl: `${appUrl}/?reset_token=${encodeURIComponent(token)}`,
          actionLabel: "Create a new password",
        },
      });
      await writeAuditEvent({
        organizationId: user.organizationId,
        actorId: user.id,
        action: "user.password_reset_requested",
        entityType: "user",
        entityId: user.id,
      });
    }

    return NextResponse.json({ ok: true, message: responseMessage }, { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}
