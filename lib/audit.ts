import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { db } from "@/db";
import { auditEvents } from "@/db/schema";

type AuditInput = {
  organizationId: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
};

export async function writeAuditEvent(input: AuditInput) {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ipHash = forwarded
    ? createHash("sha256")
        .update(`${process.env.SESSION_SECRET ?? "local"}:${forwarded}`)
        .digest("hex")
    : null;

  await db.insert(auditEvents).values({
    organizationId: input.organizationId,
    actorId: input.actorId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: input.metadata ?? {},
    ipHash,
    userAgent: requestHeaders.get("user-agent"),
  });
}
