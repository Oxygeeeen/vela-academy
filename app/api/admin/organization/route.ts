import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { apiError, ApiError } from "@/lib/api";
import { requireRole } from "@/lib/auth/session";
import { writeAuditEvent } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/security";
import { isValidTimezone } from "@/lib/schedule";

const schema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  defaultTimezone: z.string().min(1).max(80).optional(),
  defaultLocale: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/).optional(),
  logoUrl: z.string().url().nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  dataRetentionDays: z.number().int().min(30).max(3650).optional(),
  externalSharingEnabled: z.boolean().optional(),
});

export async function GET() {
  try {
    const actor = await requireRole(["owner", "admin"]);
    const [organization] = await db.select().from(organizations)
      .where(eq(organizations.id, actor.organizationId)).limit(1);
    if (!organization) throw new ApiError("Organisation not found.", 404);
    return NextResponse.json({ data: organization });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await assertSameOrigin();
    const actor = await requireRole(["owner"]);
    const input = schema.parse(await request.json());
    if (input.defaultTimezone && !isValidTimezone(input.defaultTimezone)) {
      throw new ApiError("Select a valid IANA timezone.");
    }
    const [organization] = await db.update(organizations).set({ ...input, updatedAt: new Date() })
      .where(eq(organizations.id, actor.organizationId)).returning();
    await writeAuditEvent({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: "organization.updated",
      entityType: "organization",
      entityId: actor.organizationId,
      metadata: { fields: Object.keys(input) },
    });
    return NextResponse.json({ data: organization });
  } catch (error) {
    return apiError(error);
  }
}
