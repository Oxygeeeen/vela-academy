import { NextResponse } from "next/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { assessments, lessonAssets, lessons, phases, programs } from "@/db/schema";
import { apiError, ApiError } from "@/lib/api";
import { requireRole } from "@/lib/auth/session";
import { writeAuditEvent } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/security";
import { syncProgramEnrollmentSchedules } from "@/lib/enrollment";

const programSchema = z.object({
  type: z.literal("program"),
  title: z.string().trim().min(3).max(200),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/).max(100),
  description: z.string().trim().min(20).max(5000),
  durationWeeks: z.number().int().min(4).max(52).default(14),
  classDays: z.array(z.number().int().min(0).max(6)).min(1).max(7).default([2, 5, 0]),
  defaultPassMark: z.number().int().min(1).max(100).default(70),
  publish: z.boolean().default(false),
});

const phaseSchema = z.object({
  type: z.literal("phase"),
  programId: z.string().uuid(),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(5000),
  outcome: z.string().trim().min(10).max(5000),
  position: z.number().int().min(1).max(100),
  plannedLectureCount: z.number().int().min(1).max(50).default(10),
});

const lessonSchema = z.object({
  type: z.literal("lesson"),
  phaseId: z.string().uuid(),
  title: z.string().trim().min(3).max(240),
  description: z.string().trim().min(10).max(10_000),
  learningObjectives: z.array(z.string().trim().min(2).max(300)).min(1).max(12),
  assignmentPrompt: z.string().trim().min(10).max(20_000),
  durationMinutes: z.number().int().min(30).max(180),
  position: z.number().int().min(1).max(100),
  releaseOffset: z.number().int().min(0).max(200),
  passMark: z.number().int().min(1).max(100).default(70),
  maximumAttempts: z.number().int().min(1).max(10).default(3),
  publish: z.boolean().default(false),
  assessment: z.object({
    title: z.string().trim().min(3).max(240),
    instructions: z.string().trim().min(10).max(10_000),
    submissionType: z.enum(["text", "file", "quiz", "mixed"]).default("mixed"),
    rubric: z.array(z.object({
      criterion: z.string().min(2).max(200),
      points: z.number().int().min(1).max(100),
      description: z.string().min(2).max(1000),
    })).min(1),
  }),
});

const createSchema = z.discriminatedUnion("type", [programSchema, phaseSchema, lessonSchema]);

export async function GET() {
  try {
    const actor = await requireRole(["owner", "admin", "reviewer", "trainer"]);
    const [programRows, phaseRows, lessonRows, assetRows, assessmentRows] = await Promise.all([
      db.select().from(programs).where(eq(programs.organizationId, actor.organizationId)).orderBy(asc(programs.createdAt)),
      db.select({ phase: phases }).from(phases).innerJoin(programs, eq(programs.id, phases.programId))
        .where(eq(programs.organizationId, actor.organizationId)).orderBy(asc(phases.position)),
      db.select({ lesson: lessons }).from(lessons)
        .innerJoin(phases, eq(phases.id, lessons.phaseId))
        .innerJoin(programs, eq(programs.id, phases.programId))
        .where(eq(programs.organizationId, actor.organizationId))
        .orderBy(asc(lessons.releaseOffset), asc(lessons.position)),
      db.select({ asset: lessonAssets }).from(lessonAssets)
        .innerJoin(lessons, eq(lessons.id, lessonAssets.lessonId))
        .innerJoin(phases, eq(phases.id, lessons.phaseId))
        .innerJoin(programs, eq(programs.id, phases.programId))
        .where(eq(programs.organizationId, actor.organizationId)),
      db.select({ assessment: assessments }).from(assessments)
        .innerJoin(lessons, eq(lessons.id, assessments.lessonId))
        .innerJoin(phases, eq(phases.id, lessons.phaseId))
        .innerJoin(programs, eq(programs.id, phases.programId))
        .where(eq(programs.organizationId, actor.organizationId)),
    ]);
    return NextResponse.json({
      programs: programRows,
      phases: phaseRows.map((row) => row.phase),
      lessons: lessonRows.map((row) => row.lesson),
      assets: assetRows.map((row) => row.asset),
      assessments: assessmentRows.map((row) => row.assessment),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    const actor = await requireRole(["owner", "admin", "trainer"]);
    const input = createSchema.parse(await request.json());
    let record: Record<string, unknown>;
    let affectedProgramId: string | null = null;

    if (input.type === "program") {
      [record] = await db.insert(programs).values({
        organizationId: actor.organizationId,
        title: input.title,
        slug: input.slug,
        description: input.description,
        durationWeeks: input.durationWeeks,
        classDays: input.classDays,
        defaultPassMark: input.defaultPassMark,
        status: input.publish ? "published" : "draft",
        createdBy: actor.id,
      }).returning();
    } else if (input.type === "phase") {
      const [program] = await db.select({ id: programs.id }).from(programs)
        .where(and(eq(programs.id, input.programId), eq(programs.organizationId, actor.organizationId))).limit(1);
      if (!program) throw new ApiError("Program not found.", 404);
      const [lastLesson] = await db.select({ releaseOffset: lessons.releaseOffset }).from(lessons)
        .innerJoin(phases, eq(phases.id, lessons.phaseId))
        .where(eq(phases.programId, input.programId))
        .orderBy(desc(lessons.releaseOffset))
        .limit(1);
      record = await db.transaction(async (tx) => {
        const [phase] = await tx.insert(phases).values({
          programId: input.programId,
          title: input.title,
          description: input.description,
          outcome: input.outcome,
          position: input.position,
          plannedLectureCount: input.plannedLectureCount,
        }).returning();
        const firstOffset = (lastLesson?.releaseOffset ?? -1) + 1;
        const placeholders = await tx.insert(lessons).values(Array.from({ length: input.plannedLectureCount }, (_, index) => ({
          phaseId: phase.id,
          title: `Lecture ${index + 1}`,
          description: "Session details will be available when this lecture opens.",
          learningObjectives: [],
          assignmentPrompt: "to be submitted",
          durationMinutes: 60,
          position: index + 1,
          releaseOffset: firstOffset + index,
          passMark: 70,
          maximumAttempts: 3,
          isPlaceholder: true,
          status: "published" as const,
          publishedAt: new Date(),
          createdBy: actor.id,
        }))).returning();
        return { ...phase, placeholderLessons: placeholders.length };
      });
      affectedProgramId = input.programId;
    } else {
      const [phase] = await db.select({ id: phases.id, programId: phases.programId }).from(phases)
        .innerJoin(programs, eq(programs.id, phases.programId))
        .where(and(eq(phases.id, input.phaseId), eq(programs.organizationId, actor.organizationId))).limit(1);
      if (!phase) throw new ApiError("Phase not found.", 404);
      const [lastPhaseLesson] = await db.select({ position: lessons.position }).from(lessons)
        .where(eq(lessons.phaseId, input.phaseId)).orderBy(desc(lessons.position)).limit(1);
      record = await db.transaction(async (tx) => {
        const [lesson] = await tx.insert(lessons).values({
          phaseId: input.phaseId,
          title: input.title,
          description: input.description,
          learningObjectives: input.learningObjectives,
          assignmentPrompt: input.assignmentPrompt,
          durationMinutes: input.durationMinutes,
          position: (lastPhaseLesson?.position ?? 0) + 1,
          releaseOffset: input.releaseOffset,
          passMark: input.passMark,
          maximumAttempts: input.maximumAttempts,
          isPlaceholder: false,
          status: input.publish ? "published" : "draft",
          publishedAt: input.publish ? new Date() : null,
          createdBy: actor.id,
        }).returning();
        const [assessment] = await tx.insert(assessments).values({
          lessonId: lesson.id,
          title: input.assessment.title,
          instructions: input.assessment.instructions,
          submissionType: input.assessment.submissionType,
          rubric: input.assessment.rubric,
        }).returning();
        await tx.update(phases).set({
          plannedLectureCount: sql`${phases.plannedLectureCount} + 1`,
          updatedAt: new Date(),
        }).where(eq(phases.id, input.phaseId));
        return { ...lesson, assessment };
      });
      affectedProgramId = phase.programId;
    }

    if (affectedProgramId) await syncProgramEnrollmentSchedules(affectedProgramId);

    await writeAuditEvent({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: `curriculum.${input.type}_created`,
      entityType: input.type,
      entityId: String(record.id),
    });
    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
