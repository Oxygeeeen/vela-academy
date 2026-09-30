CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`metadata_json` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_audit_events_entity` ON `audit_events` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_events_actor_created` ON `audit_events` (`actor_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `cohorts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`start_date` text NOT NULL,
	`class_days` text DEFAULT '2,5,0' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_cohorts_name` ON `cohorts` (`name`);--> statement-breakpoint
CREATE INDEX `idx_cohorts_status_start` ON `cohorts` (`status`,`start_date`);--> statement-breakpoint
CREATE TABLE `enrolments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`cohort_id` text NOT NULL,
	`assigned_start_date` text NOT NULL,
	`current_session_id` text,
	`progress_percent` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cohort_id`) REFERENCES `cohorts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_enrolments_user_cohort` ON `enrolments` (`user_id`,`cohort_id`);--> statement-breakpoint
CREATE INDEX `idx_enrolments_cohort_status` ON `enrolments` (`cohort_id`,`status`);--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` text PRIMARY KEY NOT NULL,
	`phase` integer NOT NULL,
	`position` integer NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`asset_key` text,
	`assignment_prompt` text NOT NULL,
	`pass_mark` integer DEFAULT 70 NOT NULL,
	`release_rule` text DEFAULT 'schedule_and_previous_pass' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_lessons_phase_position` ON `lessons` (`phase`,`position`);--> statement-breakpoint
CREATE INDEX `idx_lessons_status_phase` ON `lessons` (`status`,`phase`);--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`enrolment_id` text NOT NULL,
	`lesson_id` text NOT NULL,
	`attempt` integer DEFAULT 1 NOT NULL,
	`asset_key` text,
	`response_text` text,
	`score` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`submitted_at` text,
	`reviewed_at` text,
	`reviewer_id` text,
	`feedback` text,
	FOREIGN KEY (`enrolment_id`) REFERENCES `enrolments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_submissions_enrolment_lesson_attempt` ON `submissions` (`enrolment_id`,`lesson_id`,`attempt`);--> statement-breakpoint
CREATE INDEX `idx_submissions_status_submitted` ON `submissions` (`status`,`submitted_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`full_name` text NOT NULL,
	`role` text NOT NULL,
	`timezone` text,
	`status` text DEFAULT 'invited' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_role_status` ON `users` (`role`,`status`);--> statement-breakpoint
PRAGMA optimize;
