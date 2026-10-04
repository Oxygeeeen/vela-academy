import { NextResponse } from "next/server";
import { and, eq, ilike, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { cohorts, enrollments, lessonProgress, lessons, phases, programs, supportTickets, users } from "@/db/schema";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { programAccessState } from "@/lib/program-access";
import { releaseInstant } from "@/lib/schedule";

type ProgramSearchRow = {
  id: string;
  title: string;
  description: string;
  status: "draft" | "published" | "archived";
  classDays: number[];
  enrollmentStatus?: "active" | "paused" | "complete" | "withdrawn";
  progressPercent?: number;
  assignedStartDate?: string;
  timezone?: string;
};

export async function GET(request: Request) {
  try {
    const actor = await requireUser();
    const query = new URL(request.url).searchParams.get("q")?.trim();
    if (!query || query.length < 2) return NextResponse.json({ data: [] });
    const pattern = `%${query.slice(0, 80)}%`;
    const privileged = ["owner", "admin", "reviewer", "trainer"].includes(actor.role);

    const programPromise = privileged
      ? db.select({
          id: programs.id,
          title: programs.title,
          description: programs.description,
          status: programs.status,
          classDays: programs.classDays,
        }).from(programs).where(and(
          eq(programs.organizationId, actor.organizationId),
          or(ilike(programs.title, pattern), ilike(programs.description, pattern)),
        )).limit(8)
      : db.select({
          id: programs.id,
          title: programs.title,
          description: programs.description,
          status: programs.status,
          classDays: programs.classDays,
          enrollmentStatus: enrollments.status,
          progressPercent: enrollments.progressPercent,
          assignedStartDate: enrollments.assignedStartDate,
          timezone: enrollments.timezone,
        }).from(enrollments)
          .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
          .innerJoin(programs, eq(programs.id, cohorts.programId))
          .where(and(
            eq(enrollments.organizationId, actor.organizationId),
            eq(enrollments.userId, actor.id),
            or(ilike(programs.title, pattern), ilike(programs.description, pattern)),
          )).limit(8);

    const lessonPromise = privileged
      ? db.select({ id: lessons.id, title: lessons.title, description: lessons.description })
          .from(lessons)
          .innerJoin(phases, eq(phases.id, lessons.phaseId))
          .innerJoin(programs, eq(programs.id, phases.programId))
          .where(and(eq(programs.organizationId, actor.organizationId), eq(lessons.status, "published"), or(
            ilike(lessons.title, pattern),
            ilike(lessons.description, pattern),
          ))).limit(8)
      : db.select({ id: lessons.id, title: lessons.title, description: lessons.description })
          .from(enrollments)
          .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
          .innerJoin(programs, eq(programs.id, cohorts.programId))
          .innerJoin(phases, eq(phases.programId, programs.id))
          .innerJoin(lessons, eq(lessons.phaseId, phases.id))
          .innerJoin(lessonProgress, and(
            eq(lessonProgress.lessonId, lessons.id),
            eq(lessonProgress.enrollmentId, enrollments.id),
          ))
          .where(and(
            eq(enrollments.organizationId, actor.organizationId),
            eq(enrollments.userId, actor.id),
            eq(lessons.status, "published"),
            ne(lessonProgress.status, "locked"),
            or(ilike(lessons.title, pattern), ilike(lessons.description, pattern)),
          )).limit(8);

    const [programRows, lessonRows, peopleRows, ticketRows] = await Promise.all([
      programPromise,
      lessonPromise,
      privileged ? db.select({ id: users.id, title: users.fullName, email: users.email })
        .from(users).where(and(eq(users.organizationId, actor.organizationId), or(
          ilike(users.fullName, pattern),
          ilike(users.email, pattern),
        ))).limit(8) : Promise.resolve([]),
      db.select({ id: supportTickets.id, title: supportTickets.subject, status: supportTickets.status })
        .from(supportTickets).where(and(
          eq(supportTickets.organizationId, actor.organizationId),
          privileged ? or(ilike(supportTickets.subject, pattern), ilike(supportTickets.category, pattern)) : and(
            eq(supportTickets.requesterId, actor.id),
            ilike(supportTickets.subject, pattern),
          ),
        )).limit(8),
    ]);

    return NextResponse.json({
      data: [
        ...programRows.map((row) => {
          const typed = row as ProgramSearchRow;
          const accessState = programAccessState({
            privileged,
            programStatus: typed.status,
            classDays: typed.classDays,
            enrollment: typed.enrollmentStatus && typed.assignedStartDate && typed.timezone
              ? {
                  status: typed.enrollmentStatus,
                  progressPercent: typed.progressPercent ?? 0,
                  assignedStartDate: typed.assignedStartDate,
                  timezone: typed.timezone,
                }
              : null,
          });
          return {
            type: "program",
            id: typed.id,
            title: typed.title,
            description: typed.description,
            accessState,
            status: typed.status,
            availableAt: !privileged && typed.assignedStartDate && typed.timezone
              ? releaseInstant(typed.assignedStartDate, 0, typed.timezone, typed.classDays).toISOString()
              : null,
            url: `/?program=${typed.id}`,
          };
        }),
        ...lessonRows.map((row) => ({ type: "lesson", ...row, url: `/?view=curriculum&lesson=${row.id}` })),
        ...peopleRows.map((row) => ({ type: "person", ...row, url: "/?view=students" })),
        ...ticketRows.map((row) => ({ type: "support", ...row, url: `/?view=support&ticket=${row.id}` })),
      ],
    });
  } catch (error) {
    return apiError(error);
  }
}
