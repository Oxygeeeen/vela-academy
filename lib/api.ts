import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthenticationError, AuthorizationError } from "@/lib/auth/session";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function paginationFrom(url: string, maximum = 100) {
  const params = new URL(url).searchParams;
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const pageSize = Math.min(maximum, Math.max(1, Number(params.get("pageSize") ?? 20) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function apiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed.", details: error.flatten() },
      { status: 400 },
    );
  }
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof Error && "status" in error && typeof error.status === "number") {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("Unhandled API error", error);
  return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
}

export class ApiError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}
