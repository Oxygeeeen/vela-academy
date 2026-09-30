import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";

export async function GET() {
  try {
    return NextResponse.json({ user: await requireUser() });
  } catch (error) {
    return apiError(error);
  }
}
