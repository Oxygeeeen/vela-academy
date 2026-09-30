import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cohorts, enrollments, users } from "@/db/schema";
import { apiError } from "@/lib/api";
import { requireRole } from "@/lib/auth/session";

function csvCell(value: unknown) {
  const text = value instanceof Date ? value.toISOString() : String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  try {
    const actor = await requireRole(["owner", "admin"]);
    const rows = await db.select({
      learner: users.fullName,
      email: users.email,
      cohort: cohorts.name,
      startDate: enrollments.assignedStartDate,
      timezone: enrollments.timezone,
      status: enrollments.status,
      progress: enrollments.progressPercent,
      completedAt: enrollments.completedAt,
    }).from(enrollments)
      .innerJoin(users, eq(users.id, enrollments.userId))
      .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
      .where(and(eq(enrollments.organizationId, actor.organizationId), eq(users.status, "active")))
      .orderBy(asc(users.fullName));
    const headers = ["Learner", "Email", "Cohort", "Start date", "Timezone", "Status", "Progress %", "Completed at"];
    const csv = [
      headers.map(csvCell).join(","),
      ...rows.map((row) => Object.values(row).map(csvCell).join(",")),
    ].join("\r\n");
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="vela-learning-report-${new Date().toISOString().slice(0, 10)}.csv"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
