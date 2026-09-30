import { NextResponse } from "next/server";
import { clearSession, getCurrentUser } from "@/lib/auth/session";
import { writeAuditEvent } from "@/lib/audit";
import { apiError } from "@/lib/api";
import { assertSameOrigin } from "@/lib/security";

export async function POST() {
  try {
    await assertSameOrigin();
    const user = await getCurrentUser();
    await clearSession();
    if (user) {
      await writeAuditEvent({
        organizationId: user.organizationId,
        actorId: user.id,
        action: "authentication.signed_out",
        entityType: "user",
        entityId: user.id,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
