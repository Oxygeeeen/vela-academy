CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_unique" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_expires_idx" ON "password_reset_tokens" USING btree ("user_id","expires_at");--> statement-breakpoint
UPDATE "users" AS "account"
SET "email" = 'vela@scaleworkagency.com', "updated_at" = now()
FROM "organizations" AS "organization"
WHERE "account"."organization_id" = "organization"."id"
  AND "organization"."slug" = 'vela'
  AND "account"."email" = 'admin@vela.academy'
  AND NOT EXISTS (
    SELECT 1 FROM "users" AS "existing"
    WHERE "existing"."organization_id" = "account"."organization_id"
      AND "existing"."email" = 'vela@scaleworkagency.com'
  );
