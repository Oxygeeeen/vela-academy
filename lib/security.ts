import { headers } from "next/headers";
import { ApiError } from "@/lib/api";

export async function assertSameOrigin() {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!origin || !host) return;
  const originHost = new URL(origin).host;
  if (originHost !== host) throw new ApiError("Cross-origin request rejected.", 403);
}

export function safeRedirectPath(value: string | null | undefined, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export function verifyCronAuthorization(authorization: string | null) {
  const expected = process.env.CRON_SECRET;
  if (!expected || authorization !== `Bearer ${expected}`) {
    throw new ApiError("Cron authorization failed.", 401);
  }
}
