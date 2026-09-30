import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { lessons, phases, programs } from "@/db/schema";
import { apiError, ApiError } from "@/lib/api";
import { requireRole } from "@/lib/auth/session";
import { writeAuditEvent } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/security";

const schema = z.object({
  title: z.string().trim().min(3).max(240).optional(),
  description: z.string().trim().min(10).max(10_000).optional(),
  learningObjectives: z.array(z.string().trim().min(2).max(300)).min(1).max(12).optional(),
  assignmentPrompt: z.string().trim().min(10).max(20_000).optional(),
  durationMinutes: z.number().int().min(30).max(180).optional(),
  releaseOffset: z.number().int().min(0).max(200).optional(),
  passMark: z.number().int().min(1).max(100).optional(),
  maximumAttempts: z.number().int().min(1).max(10).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await assertSameOrigin();
    const actor = await requireRole(["owner", "admin", "trainer"]);
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    const [owned] = await db.select({ id: lessons.id }).from(lessons)
      .innerJoin(phases, eq(phases.id, lessons.phaseId))
      .innerJoin(programs, eq(programs.id, phases.programId))
      .where(and(eq(lessons.id, id), eq(programs.organizationId, actor.organizationId))).limit(1);
    if (!owned) throw new ApiError("Lesson not found.", 404);
    const [lesson] = await db.update(lessons).set({
      ...input,
      publishedAt: input.status === "published" ? new Date() : undefined,
      updatedAt: new Date(),
    }).where(eq(lessons.id, id)).returning();
    await writeAuditEvent({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: "curriculum.lesson_updated",
      entityType: "lesson",
      entityId: id,
      metadata: { fields: Object.keys(input) },
    });
    return NextResponse.json({ data: lesson });
  } catch (error) {
    return apiError(error);
  }
}
