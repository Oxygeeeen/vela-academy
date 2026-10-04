import { NextResponse } from "next/server";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { assessments, cohorts, lessons, phases, programs, submissions } from "@/db/schema";
import { apiError, ApiError } from "@/lib/api";
import { requireRole } from "@/lib/auth/session";
import { writeAuditEvent } from "@/lib/audit";
import { syncProgramEnrollmentSchedules } from "@/lib/enrollment";
import { assertSameOrigin } from "@/lib/security";

const programSchema = z.object({
  type: z.literal("program"),
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().min(20).max(5000).optional(),
  durationWeeks: z.number().int().min(4).max(52).optional(),
  classDays: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
  defaultPassMark: z.number().int().min(1).max(100).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
});

const phaseSchema = z.object({
  type: z.literal("phase"),
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().min(10).max(5000).optional(),
  outcome: z.string().trim().min(10).max(5000).optional(),
  plannedLectureCount: z.number().int().min(1).max(50).optional(),
});

const lessonSchema = z.object({
  type: z.literal("lesson"),
  title: z.string().trim().min(3).max(240).optional(),
  description: z.string().trim().min(10).max(10_000).optional(),
  learningObjectives: z.array(z.string().trim().min(2).max(300)).min(1).max(12).optional(),
  assignmentPrompt: z.string().trim().min(10).max(20_000).optional(),
  durationMinutes: z.number().int().min(30).max(180).optional(),
  releaseOffset: z.number().int().min(0).max(200).optional(),
  passMark: z.number().int().min(1).max(100).optional(),
  maximumAttempts: z.number().int().min(1).max(10).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  isPlaceholder: z.boolean().optional(),
});

const updateSchema = z.discriminatedUnion("type", [programSchema, phaseSchema, lessonSchema]);
const entitySchema = z.enum(["program", "phase", "lesson"]);

function omitType<T extends { type: string }>(input: T): Omit<T, "type"> {
  const result = { ...input } as Partial<T>;
  delete result.type;
  return result as Omit<T, "type">;
}

function placeholderValues(input: { phaseId: string; count: number; firstPosition: number; firstOffset: number; actorId: string }) {
  return Array.from({ length: input.count }, (_, index) => ({
    phaseId: input.phaseId,
    title: `Lecture ${input.firstPosition + index}`,
    description: "Session details will be available when this lecture opens.",
    learningObjectives: [],
    assignmentPrompt: "to be submitted",
    durationMinutes: 60,
    position: input.firstPosition + index,
    releaseOffset: input.firstOffset + index,
    passMark: 70,
    maximumAttempts: 3,
    isPlaceholder: true,
    status: "published" as const,
    publishedAt: new Date(),
    createdBy: input.actorId,
  }));
}

async function normalizeProgramReleaseOffsets(programId: string) {
  const rows = await db.select({ id: lessons.id }).from(lessons)
    .innerJoin(phases, eq(phases.id, lessons.phaseId))
    .where(eq(phases.programId, programId))
    .orderBy(asc(phases.position), asc(lessons.position));
  for (const [index, lesson] of rows.entries()) {
    await db.update(lessons).set({ releaseOffset: index, updatedAt: new Date() }).where(eq(lessons.id, lesson.id));
  }
}

async function normalizePhasePositions(phaseId: string) {
  const rows = await db.select({ id: lessons.id }).from(lessons)
    .where(eq(lessons.phaseId, phaseId)).orderBy(asc(lessons.position));
  await db.update(lessons).set({ position: sql`${lessons.position} + 1000` }).where(eq(lessons.phaseId, phaseId));
  for (const [index, lesson] of rows.entries()) {
    await db.update(lessons).set({ position: index + 1, updatedAt: new Date() }).where(eq(lessons.id, lesson.id));
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await assertSameOrigin();
    const actor = await requireRole(["owner", "admin", "trainer"]);
    const { id } = await context.params;
    const input = updateSchema.parse(await request.json());
    let data: Record<string, unknown>;
    let programId: string;
    let normalizeOffsets = false;

    if (input.type === "program") {
      const [owned] = await db.select({ id: programs.id }).from(programs)
        .where(and(eq(programs.id, id), eq(programs.organizationId, actor.organizationId))).limit(1);
      if (!owned) throw new ApiError("Program not found.", 404);
      const changes = omitType(input);
      [data] = await db.update(programs).set({ ...changes, updatedAt: new Date() }).where(eq(programs.id, id)).returning();
      programId = id;
    } else if (input.type === "phase") {
      const [owned] = await db.select({ id: phases.id, programId: phases.programId }).from(phases)
        .innerJoin(programs, eq(programs.id, phases.programId))
        .where(and(eq(phases.id, id), eq(programs.organizationId, actor.organizationId))).limit(1);
      if (!owned) throw new ApiError("Phase not found.", 404);
      const phaseLessons = await db.select({ id: lessons.id, isPlaceholder: lessons.isPlaceholder, position: lessons.position })
        .from(lessons).where(eq(lessons.phaseId, id)).orderBy(desc(lessons.position));
      const targetCount = input.plannedLectureCount ?? phaseLessons.length;
      const removeCount = Math.max(0, phaseLessons.length - targetCount);
      const removable = phaseLessons.filter((lesson) => lesson.isPlaceholder).slice(0, removeCount);
      if (removable.length < removeCount) throw new ApiError("Lecture count cannot be lower than the number of completed lecture records. Delete individual unused lectures first.", 409);
      const [lastLesson] = await db.select({ releaseOffset: lessons.releaseOffset }).from(lessons)
        .innerJoin(phases, eq(phases.id, lessons.phaseId))
        .where(eq(phases.programId, owned.programId)).orderBy(desc(lessons.releaseOffset)).limit(1);
      data = await db.transaction(async (tx) => {
        if (removable.length) await tx.delete(lessons).where(inArray(lessons.id, removable.map((lesson) => lesson.id)));
        const addCount = Math.max(0, targetCount - phaseLessons.length);
        if (addCount) await tx.insert(lessons).values(placeholderValues({
          phaseId: id,
          count: addCount,
          firstPosition: phaseLessons.length + 1,
          firstOffset: (lastLesson?.releaseOffset ?? -1) + 1,
          actorId: actor.id,
        }));
        const changes = omitType(input);
        const [phase] = await tx.update(phases).set({ ...changes, plannedLectureCount: targetCount, updatedAt: new Date() })
          .where(eq(phases.id, id)).returning();
        return phase;
      });
      if (input.plannedLectureCount !== undefined) await normalizePhasePositions(id);
      programId = owned.programId;
      normalizeOffsets = input.plannedLectureCount !== undefined;
    } else {
      const [owned] = await db.select({ id: lessons.id, programId: phases.programId }).from(lessons)
        .innerJoin(phases, eq(phases.id, lessons.phaseId))
        .innerJoin(programs, eq(programs.id, phases.programId))
        .where(and(eq(lessons.id, id), eq(programs.organizationId, actor.organizationId))).limit(1);
      if (!owned) throw new ApiError("Lecture not found.", 404);
      const changes = omitType(input);
      data = await db.transaction(async (tx) => {
        const [lesson] = await tx.update(lessons).set({ ...changes, publishedAt: input.status === "published" ? new Date() : undefined, updatedAt: new Date() })
          .where(eq(lessons.id, id)).returning();
        if (input.assignmentPrompt || input.title) {
          const title = `${input.title ?? lesson.title} assessment`;
          const instructions = input.assignmentPrompt ?? lesson.assignmentPrompt;
          await tx.insert(assessments).values({
            lessonId: id,
            title,
            instructions,
            submissionType: "mixed",
            rubric: [
              { criterion: "Application", points: 40, description: "Applies the lesson method to a realistic enterprise context." },
              { criterion: "Accuracy", points: 35, description: "Uses accurate concepts and evidence." },
              { criterion: "Responsible practice", points: 25, description: "Addresses safety, inclusion, privacy, and transfer." },
            ],
          }).onConflictDoUpdate({ target: assessments.lessonId, set: { title, instructions, updatedAt: new Date() } });
        }
        return lesson;
      });
      programId = owned.programId;
    }

    if (normalizeOffsets) await normalizeProgramReleaseOffsets(programId);
    await syncProgramEnrollmentSchedules(programId);
    await writeAuditEvent({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: `curriculum.${input.type}_updated`,
      entityType: input.type,
      entityId: id,
      metadata: { fields: Object.keys(input).filter((field) => field !== "type") },
    });
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await assertSameOrigin();
    const actor = await requireRole(["owner", "admin", "trainer"]);
    const { id } = await context.params;
    const type = entitySchema.parse(new URL(request.url).searchParams.get("type"));
    let programId: string | null = null;

    if (type === "program") {
      const [owned] = await db.select({ id: programs.id }).from(programs)
        .where(and(eq(programs.id, id), eq(programs.organizationId, actor.organizationId))).limit(1);
      if (!owned) throw new ApiError("Program not found.", 404);
      const [used] = await db.select({ id: cohorts.id }).from(cohorts).where(eq(cohorts.programId, id)).limit(1);
      if (used) throw new ApiError("This program has cohort history and cannot be permanently deleted. Edit it and set its status to archived instead.", 409);
      await db.delete(programs).where(eq(programs.id, id));
    } else if (type === "phase") {
      const [owned] = await db.select({ id: phases.id, programId: phases.programId }).from(phases)
        .innerJoin(programs, eq(programs.id, phases.programId))
        .where(and(eq(phases.id, id), eq(programs.organizationId, actor.organizationId))).limit(1);
      if (!owned) throw new ApiError("Phase not found.", 404);
      const [used] = await db.select({ id: submissions.id }).from(submissions)
        .innerJoin(lessons, eq(lessons.id, submissions.lessonId)).where(eq(lessons.phaseId, id)).limit(1);
      if (used) throw new ApiError("This phase contains learner submissions and cannot be permanently deleted.", 409);
      await db.transaction(async (tx) => {
        await tx.delete(phases).where(eq(phases.id, id));
        const remaining = await tx.select({ id: phases.id }).from(phases).where(eq(phases.programId, owned.programId)).orderBy(asc(phases.position));
        await tx.update(phases).set({ position: sql`${phases.position} + 1000` }).where(eq(phases.programId, owned.programId));
        for (const [index, phase] of remaining.entries()) await tx.update(phases).set({ position: index + 1, updatedAt: new Date() }).where(eq(phases.id, phase.id));
      });
      programId = owned.programId;
    } else {
      const [owned] = await db.select({ id: lessons.id, phaseId: lessons.phaseId, programId: phases.programId }).from(lessons)
        .innerJoin(phases, eq(phases.id, lessons.phaseId))
        .innerJoin(programs, eq(programs.id, phases.programId))
        .where(and(eq(lessons.id, id), eq(programs.organizationId, actor.organizationId))).limit(1);
      if (!owned) throw new ApiError("Lecture not found.", 404);
      const [used] = await db.select({ id: submissions.id }).from(submissions).where(eq(submissions.lessonId, id)).limit(1);
      if (used) throw new ApiError("This lecture has learner submissions and cannot be permanently deleted.", 409);
      await db.transaction(async (tx) => {
        await tx.delete(lessons).where(eq(lessons.id, id));
        await tx.update(phases).set({ plannedLectureCount: sql`greatest(0, ${phases.plannedLectureCount} - 1)`, updatedAt: new Date() }).where(eq(phases.id, owned.phaseId));
        const phaseLessons = await tx.select({ id: lessons.id }).from(lessons).where(eq(lessons.phaseId, owned.phaseId)).orderBy(asc(lessons.position));
        await tx.update(lessons).set({ position: sql`${lessons.position} + 1000` }).where(eq(lessons.phaseId, owned.phaseId));
        for (const [index, lesson] of phaseLessons.entries()) await tx.update(lessons).set({ position: index + 1, updatedAt: new Date() }).where(eq(lessons.id, lesson.id));
        const programLessons = await tx.select({ id: lessons.id }).from(lessons)
          .innerJoin(phases, eq(phases.id, lessons.phaseId)).where(eq(phases.programId, owned.programId))
          .orderBy(asc(lessons.releaseOffset), asc(phases.position), asc(lessons.position));
        for (const [index, lesson] of programLessons.entries()) await tx.update(lessons).set({ releaseOffset: index, updatedAt: new Date() }).where(eq(lessons.id, lesson.id));
      });
      programId = owned.programId;
    }

    if (programId) {
      await normalizeProgramReleaseOffsets(programId);
      await syncProgramEnrollmentSchedules(programId);
    }
    await writeAuditEvent({ organizationId: actor.organizationId, actorId: actor.id, action: `curriculum.${type}_deleted`, entityType: type, entityId: id });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
