import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { certificates, cohorts, enrollments, organizations, programs, users } from "@/db/schema";
import { apiError, ApiError } from "@/lib/api";

export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const [certificate] = await db.select({
      verificationCode: certificates.verificationCode,
      issuedAt: certificates.issuedAt,
      expiresAt: certificates.expiresAt,
      revokedAt: certificates.revokedAt,
      metadata: certificates.metadata,
      learnerName: users.fullName,
      programme: programs.title,
      organization: organizations.name,
    }).from(certificates)
      .innerJoin(enrollments, eq(enrollments.id, certificates.enrollmentId))
      .innerJoin(users, eq(users.id, enrollments.userId))
      .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
      .innerJoin(programs, eq(programs.id, cohorts.programId))
      .innerJoin(organizations, eq(organizations.id, certificates.organizationId))
      .where(eq(certificates.verificationCode, code.toUpperCase())).limit(1);
    if (!certificate) throw new ApiError("Certificate not found.", 404);
    const valid = !certificate.revokedAt && (!certificate.expiresAt || certificate.expiresAt > new Date());
    return NextResponse.json({ valid, certificate });
  } catch (error) {
    return apiError(error);
  }
}
