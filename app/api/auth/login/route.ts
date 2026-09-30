import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { organizations, users } from "@/db/schema";
import { apiError, normalizeEmail } from "@/lib/api";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { writeAuditEvent } from "@/lib/audit";
import { assertRateLimit } from "@/lib/rate-limit";
import { assertSameOrigin } from "@/lib/security";

const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(256),
  organization: z.string().trim().min(1).max(80).optional(),
});

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    const requestHeaders = await headers();
    const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    await assertRateLimit(`login:${ip}`, 10, 900);

    const body = loginSchema.parse(await request.json());
    const email = normalizeEmail(body.email);
    const filters = [eq(users.email, email)];
    if (body.organization) filters.push(eq(organizations.slug, body.organization.toLowerCase()));

    const matches = await db
      .select({
        id: users.id,
        organizationId: users.organizationId,
        email: users.email,
        fullName: users.fullName,
        passwordHash: users.passwordHash,
        role: users.role,
        status: users.status,
        sessionVersion: users.sessionVersion,
        failedLoginCount: users.failedLoginCount,
        lockedUntil: users.lockedUntil,
      })
      .from(users)
      .innerJoin(organizations, eq(organizations.id, users.organizationId))
      .where(and(...filters))
      .limit(2);

    if (matches.length !== 1) {
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    }
    const user = matches[0];
    if (user.status !== "active" || (user.lockedUntil && user.lockedUntil > new Date())) {
      return NextResponse.json({ error: "This account is not currently available. Contact your administrator." }, { status: 403 });
    }

    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) {
      const failures = user.failedLoginCount + 1;
      await db.update(users).set({
        failedLoginCount: failures,
        lockedUntil: failures >= 5 ? new Date(Date.now() + 15 * 60_000) : null,
        updatedAt: new Date(),
      }).where(eq(users.id, user.id));
      await writeAuditEvent({
        organizationId: user.organizationId,
        actorId: user.id,
        action: "authentication.failed",
        entityType: "user",
        entityId: user.id,
        metadata: { failures },
      });
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    }

    await db.update(users).set({
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(users.id, user.id));
    await createSession(user);
    await writeAuditEvent({
      organizationId: user.organizationId,
      actorId: user.id,
      action: "authentication.succeeded",
      entityType: "user",
      entityId: user.id,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
