import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getEnv } from "@/lib/env";

export const SESSION_COOKIE = "vela_session";

export type AppRole = "owner" | "admin" | "reviewer" | "trainer" | "student";

export type SessionUser = {
  id: string;
  organizationId: string;
  email: string;
  fullName: string;
  role: AppRole;
  timezone: string | null;
  locale: string;
  mustChangePassword: boolean;
};

type SessionClaims = {
  userId: string;
  organizationId: string;
  email: string;
  fullName: string;
  role: AppRole;
  sessionVersion: number;
};

export class AuthenticationError extends Error {
  status = 401;
}

export class AuthorizationError extends Error {
  status = 403;
}

function signingKey() {
  return new TextEncoder().encode(getEnv().SESSION_SECRET);
}

export async function createSession(user: {
  id: string;
  organizationId: string;
  email: string;
  fullName: string;
  role: AppRole;
  sessionVersion: number;
}) {
  const env = getEnv();
  const token = await new SignJWT({
    userId: user.id,
    organizationId: user.organizationId,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    sessionVersion: user.sessionVersion,
  } satisfies SessionClaims)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${env.SESSION_TTL_SECONDS}s`)
    .setJti(crypto.randomUUID())
    .sign(signingKey());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.APP_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: env.SESSION_TTL_SECONDS,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: getOptionalProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

function getOptionalProduction() {
  return process.env.APP_ENV === "production" || process.env.NODE_ENV === "production";
}

export async function readSessionToken(): Promise<SessionClaims | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const verified = await jwtVerify(token, signingKey(), { algorithms: ["HS256"] });
    return verified.payload as unknown as SessionClaims;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const claims = await readSessionToken();
  if (!claims) return null;

  const [record] = await db
    .select({
      id: users.id,
      organizationId: users.organizationId,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      timezone: users.timezone,
      locale: users.locale,
      mustChangePassword: users.mustChangePassword,
      sessionVersion: users.sessionVersion,
    })
    .from(users)
    .where(and(eq(users.id, claims.userId), eq(users.organizationId, claims.organizationId), eq(users.status, "active")))
    .limit(1);

  if (!record || record.sessionVersion !== claims.sessionVersion) return null;
  return {
    id: record.id,
    organizationId: record.organizationId,
    email: record.email,
    fullName: record.fullName,
    role: record.role,
    timezone: record.timezone,
    locale: record.locale,
    mustChangePassword: record.mustChangePassword,
  };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new AuthenticationError("Authentication required.");
  return user;
}

export async function requireRole(roles: AppRole[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new AuthorizationError("You do not have permission to perform this action.");
  return user;
}
