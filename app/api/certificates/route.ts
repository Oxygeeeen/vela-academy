import { NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { certificates, cohorts, enrollments, programs } from "@/db/schema";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";

export async function GET() {
  try {
    const actor = await requireUser();
    const rows = await db.select({
      id: certificates.id,
      verificationCode: certificates.verificationCode,
      issuedAt: certificates.issuedAt,
      expiresAt: certificates.expiresAt,
      metadata: certificates.metadata,
      programTitle: programs.title,
      cohortName: cohorts.name,
    }).from(certificates)
      .innerJoin(enrollments, eq(enrollments.id, certificates.enrollmentId))
      .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
      .innerJoin(programs, eq(programs.id, cohorts.programId))
      .where(and(
        eq(enrollments.userId, actor.id),
        eq(certificates.organizationId, actor.organizationId),
        isNull(certificates.revokedAt),
      ))
      .orderBy(desc(certificates.issuedAt));
    return NextResponse.json({ data: rows });
  } catch (error) {
    return apiError(error);
  }
}
