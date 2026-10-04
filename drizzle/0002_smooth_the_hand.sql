ALTER TABLE "lessons" ADD COLUMN "is_placeholder" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "phases" ADD COLUMN "planned_lecture_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "phases" SET "planned_lecture_count" = (
  SELECT COUNT(*)::integer FROM "lessons" WHERE "lessons"."phase_id" = "phases"."id"
);
