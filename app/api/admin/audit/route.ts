import { NextResponse } from "next/server";
import { and, count, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, users } from "@/db/schema";
import { apiError, paginationFrom } from "@/lib/api";
import { requireRole } from "@/lib/auth/session";

export async function GET(request: Request) {
  try {
    const actor = await requireRole(["owner", "admin"]);
    const { page, pageSize, offset } = paginationFrom(request.url);
    const params = new URL(request.url).searchParams;
    const action = params.get("action");
    const from = params.get("from");
    const to = params.get("to");
    const filters = [eq(auditEvents.organizationId, actor.organizationId)];
    if (action) filters.push(eq(auditEvents.action, action));
    if (from) filters.push(gte(auditEvents.createdAt, new Date(from)));
    if (to) filters.push(lte(auditEvents.createdAt, new Date(to)));
    const condition = and(...filters);
    const [rows, total] = await Promise.all([
      db.select({
        id: auditEvents.id,
        action: auditEvents.action,
        entityType: auditEvents.entityType,
        entityId: auditEvents.entityId,
        metadata: auditEvents.metadata,
        ipHash: auditEvents.ipHash,
        createdAt: auditEvents.createdAt,
        actorName: users.fullName,
        actorEmail: users.email,
      }).from(auditEvents)
        .leftJoin(users, eq(users.id, auditEvents.actorId))
        .where(condition)
        .orderBy(desc(auditEvents.createdAt)).limit(pageSize).offset(offset),
      db.select({ value: count() }).from(auditEvents).where(condition),
    ]);
    return NextResponse.json({ data: rows, pagination: { page, pageSize, total: total[0]?.value ?? 0 } });
  } catch (error) {
    return apiError(error);
  }
}
