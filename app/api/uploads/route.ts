import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { lessonAssets, lessons, phases, programs } from "@/db/schema";
import { apiError, ApiError } from "@/lib/api";
import { requireRole } from "@/lib/auth/session";
import { getOptionalEnv } from "@/lib/env";
import { assertSameOrigin } from "@/lib/security";

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

async function assertOwnedLesson(lessonId: string, organizationId: string) {
  const [owned] = await db.select({ id: lessons.id }).from(lessons)
    .innerJoin(phases, eq(phases.id, lessons.phaseId))
    .innerJoin(programs, eq(programs.id, phases.programId))
    .where(and(eq(lessons.id, lessonId), eq(programs.organizationId, organizationId))).limit(1);
  if (!owned) throw new ApiError("Lesson not found.", 404);
  const [assetCount] = await db.select({ value: count() }).from(lessonAssets).where(eq(lessonAssets.lessonId, lessonId));
  if ((assetCount?.value ?? 0) >= 5) throw new ApiError("A lecture can contain a maximum of five files.", 409);
}

async function localUpload(request: Request) {
  await assertSameOrigin();
  const actor = await requireRole(["owner", "admin", "trainer"]);
  const hostname = new URL(request.url).hostname;
  if (!["localhost", "127.0.0.1", "::1"].includes(hostname)) {
    throw new ApiError("Lecture file storage is not configured. Connect Vercel Blob and add BLOB_READ_WRITE_TOKEN.", 503);
  }
  const form = await request.formData();
  const file = form.get("file");
  const metadata = payloadSchema.parse({
    lessonId: form.get("lessonId"),
    kind: form.get("kind"),
    filename: form.get("filename"),
    contentType: form.get("contentType"),
    sizeBytes: Number(form.get("sizeBytes")),
    accessibilityLabel: form.get("accessibilityLabel") || undefined,
  });
  if (!(file instanceof File)) throw new ApiError("Choose a lecture file to upload.");
  const maximumSizeInBytes = getOptionalEnv().MAX_UPLOAD_BYTES ?? 25_000_000;
  if (metadata.sizeBytes > maximumSizeInBytes || file.size > maximumSizeInBytes) throw new ApiError("File exceeds the upload limit.", 413);
  if (!allowedContentTypes.includes(metadata.contentType)) throw new ApiError("This file type is not allowed.", 415);
  await assertOwnedLesson(metadata.lessonId, actor.organizationId);

  const safeName = metadata.filename.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-180);
  const storedName = `${crypto.randomUUID()}-${safeName}`;
  const pathname = `local-uploads/${storedName}`;
  const directory = join(process.cwd(), "public", "local-uploads");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, storedName), Buffer.from(await file.arrayBuffer()), { flag: "wx" });
  const [asset] = await db.insert(lessonAssets).values({
    lessonId: metadata.lessonId,
    kind: metadata.kind,
    url: `/${pathname}`,
    pathname,
    filename: metadata.filename,
    contentType: metadata.contentType,
    sizeBytes: metadata.sizeBytes,
    accessibilityLabel: metadata.accessibilityLabel,
    uploadedBy: actor.id,
  }).returning();
  return NextResponse.json({ data: asset, storage: "local" }, { status: 201 });
}

export async function POST(request: Request) {
  try {
    if (request.headers.get("content-type")?.includes("multipart/form-data")) return await localUpload(request);
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
        await assertOwnedLesson(metadata.lessonId, actor.organizationId);
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
