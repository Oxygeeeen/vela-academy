import "server-only";

import { lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";
import { ApiError } from "@/lib/api";

export async function assertRateLimit(key: string, maximum: number, windowSeconds: number) {
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000);
  const expiresAt = new Date(windowStart.getTime() + windowSeconds * 1000);

  const [record] = await db
    .insert(rateLimits)
    .values({ key, windowStart, expiresAt, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1`, expiresAt },
    })
    .returning({ count: rateLimits.count });

  if (record.count > maximum) {
    const error = new ApiError("Too many requests. Please try again shortly.", 429);
    Object.assign(error, { retryAfter: Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000)) });
    throw error;
  }
  return { remaining: Math.max(0, maximum - record.count), resetAt: expiresAt };
}

export async function clearExpiredRateLimits() {
  await db.delete(rateLimits).where(lt(rateLimits.expiresAt, new Date()));
}
