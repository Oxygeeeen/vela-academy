import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { refreshAllActiveEnrollments } from "@/lib/enrollment";
import { verifyCronAuthorization } from "@/lib/security";

export async function GET(request: Request) {
  try {
    verifyCronAuthorization(request.headers.get("authorization"));
    return NextResponse.json({ ok: true, ...(await refreshAllActiveEnrollments()), ranAt: new Date().toISOString() });
  } catch (error) {
    return apiError(error);
  }
}
