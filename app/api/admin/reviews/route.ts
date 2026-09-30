import { NextResponse } from "next/server";
import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { enrollments, lessons, submissions, users } from "@/db/schema";
import { apiError, paginationFrom } from "@/lib/api";
import { requireRole } from "@/lib/auth/session";

export async function GET(request: Request) {
  try {
    const actor = await requireRole(["owner", "admin", "reviewer"]);
    const { page, pageSize, offset } = paginationFrom(request.url);
    const params = new URL(request.url).searchParams;
    const status = params.get("status") ?? "submitted";
    const search = params.get("q")?.trim();
    const filters = [eq(submissions.organizationId, actor.organizationId)];
    if (status !== "all") filters.push(eq(submissions.status, status as "submitted"));
    if (search) filters.push(or(ilike(users.fullName, `%${search}%`), ilike(lessons.title, `%${search}%`))!);
    const condition = and(...filters);

    const [rows, total] = await Promise.all([
      db.select({
        id: submissions.id,
        studentId: users.id,
        studentName: users.fullName,
        studentEmail: users.email,
        lessonId: lessons.id,
        lessonTitle: lessons.title,
        attempt: submissions.attempt,
        responseText: submissions.responseText,
        answers: submissions.answers,
        status: submissions.status,
        score: submissions.score,
        submittedAt: submissions.submittedAt,
        passMark: lessons.passMark,
      }).from(submissions)
        .innerJoin(enrollments, eq(enrollments.id, submissions.enrollmentId))
        .innerJoin(users, eq(users.id, enrollments.userId))
        .innerJoin(lessons, eq(lessons.id, submissions.lessonId))
        .where(condition)
        .orderBy(desc(submissions.submittedAt))
        .limit(pageSize).offset(offset),
      db.select({ value: count() }).from(submissions)
        .innerJoin(enrollments, eq(enrollments.id, submissions.enrollmentId))
        .innerJoin(users, eq(users.id, enrollments.userId))
        .innerJoin(lessons, eq(lessons.id, submissions.lessonId))
        .where(condition),
    ]);
    return NextResponse.json({ data: rows, pagination: { page, pageSize, total: total[0]?.value ?? 0 } });
  } catch (error) {
    return apiError(error);
  }
}
