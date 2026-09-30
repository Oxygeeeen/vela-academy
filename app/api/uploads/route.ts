import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { lessonAssets, lessons, phases, programs } from "@/db/schema";
import { apiError, ApiError } from "@/lib/api";
import { requireRole } from "@/lib/auth/session";
import { getOptionalEnv } from "@/lib/env";

const payloadSchema = z.object({
  lessonId: z.string().uuid(),
  kind: z.enum(["video", "slides", "document", "transcript", "caption", "worksheet"]),
  filename: z.string().min(1).max(260),
  contentType: z.string().min(1).max(160),
  sizeBytes: z.number().int().positive(),
  accessibilityLabel: z.string().max(240).optional(),
});

const allowedContentTypes = [
  "video/mp4",
  "video/webm",
  "application/pdf",
  "text/plain",
  "text/vtt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export async function POST(request: Request) {
  try {
    const body = await request.json() as HandleUploadBody;
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const actor = await requireRole(["owner", "admin", "trainer"]);
        const metadata = payloadSchema.parse(JSON.parse(clientPayload ?? "{}"));
        const maximumSizeInBytes = getOptionalEnv().MAX_UPLOAD_BYTES ?? 25_000_000;
        if (metadata.sizeBytes > maximumSizeInBytes) throw new ApiError("File exceeds the upload limit.", 413);
        if (!allowedContentTypes.includes(metadata.contentType)) throw new ApiError("This file type is not allowed.", 415);
        const [owned] = await db.select({ id: lessons.id }).from(lessons)
          .innerJoin(phases, eq(phases.id, lessons.phaseId))
          .innerJoin(programs, eq(programs.id, phases.programId))
          .where(and(eq(lessons.id, metadata.lessonId), eq(programs.organizationId, actor.organizationId))).limit(1);
        if (!owned) throw new ApiError("Lesson not found.", 404);
        return {
          allowedContentTypes,
          maximumSizeInBytes,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ ...metadata, userId: actor.id, organizationId: actor.organizationId }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const metadata = payloadSchema.extend({
          userId: z.string().uuid(),
          organizationId: z.string().uuid(),
        }).parse(JSON.parse(tokenPayload ?? "{}"));
        await db.insert(lessonAssets).values({
          lessonId: metadata.lessonId,
          kind: metadata.kind,
          url: blob.url,
          pathname: blob.pathname,
          filename: metadata.filename,
          contentType: metadata.contentType,
          sizeBytes: metadata.sizeBytes,
          accessibilityLabel: metadata.accessibilityLabel,
          uploadedBy: metadata.userId,
        });
      },
    });
    return NextResponse.json(response);
  } catch (error) {
    return apiError(error);
  }
}
