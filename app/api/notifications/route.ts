import { NextResponse } from "next/server";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { apiError, ApiError, paginationFrom } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security";

const schema = z.object({
  id: z.string().uuid().optional(),
  markAllRead: z.boolean().optional(),
});

export async function GET(request: Request) {
  try {
    const actor = await requireUser();
    const { page, pageSize, offset } = paginationFrom(request.url);
    const [rows, unread] = await Promise.all([
      db.select().from(notifications).where(eq(notifications.userId, actor.id))
        .orderBy(desc(notifications.createdAt)).limit(pageSize).offset(offset),
      db.select({ value: count() }).from(notifications)
        .where(and(eq(notifications.userId, actor.id), isNull(notifications.readAt))),
    ]);
    return NextResponse.json({ data: rows, unread: unread[0]?.value ?? 0, pagination: { page, pageSize } });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await assertSameOrigin();
    const actor = await requireUser();
    const input = schema.parse(await request.json());
    if (!input.id && !input.markAllRead) throw new ApiError("Select a notification or mark all as read.");
    const condition = input.markAllRead
      ? eq(notifications.userId, actor.id)
      : and(eq(notifications.id, input.id!), eq(notifications.userId, actor.id));
    await db.update(notifications).set({ readAt: new Date() }).where(condition);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
