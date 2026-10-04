import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 80 }).notNull(),
  defaultTimezone: varchar("default_timezone", { length: 80 }).notNull().default("UTC"),
  defaultLocale: varchar("default_locale", { length: 16 }).notNull().default("en"),
  logoUrl: text("logo_url"),
  primaryColor: varchar("primary_color", { length: 16 }).notNull().default("#2448c5"),
  dataRetentionDays: integer("data_retention_days").notNull().default(2555),
  externalSharingEnabled: boolean("external_sharing_enabled").notNull().default(false),
  status: varchar("status", { length: 24 }).$type<"active" | "suspended">().notNull().default("active"),
  createdAt,
  updatedAt,
}, (table) => [
  uniqueIndex("organizations_slug_unique").on(table.slug),
  index("organizations_status_idx").on(table.status),
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 320 }).notNull(),
  fullName: varchar("full_name", { length: 160 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 24 }).$type<"owner" | "admin" | "reviewer" | "trainer" | "student">().notNull(),
  timezone: varchar("timezone", { length: 80 }),
  locale: varchar("locale", { length: 16 }).notNull().default("en"),
  status: varchar("status", { length: 24 }).$type<"invited" | "active" | "suspended" | "deleted">().notNull().default("invited"),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  sessionVersion: integer("session_version").notNull().default(1),
  failedLoginCount: integer("failed_login_count").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  createdAt,
  updatedAt,
}, (table) => [
  uniqueIndex("users_org_email_unique").on(table.organizationId, table.email),
  index("users_org_role_status_idx").on(table.organizationId, table.role, table.status),
]);

export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt,
}, (table) => [
  uniqueIndex("invitations_token_hash_unique").on(table.tokenHash),
  index("invitations_user_expires_idx").on(table.userId, table.expiresAt),
]);

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt,
}, (table) => [
  uniqueIndex("password_reset_tokens_token_hash_unique").on(table.tokenHash),
  index("password_reset_tokens_user_expires_idx").on(table.userId, table.expiresAt),
]);

export const programs = pgTable("programs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  description: text("description").notNull(),
  durationWeeks: integer("duration_weeks").notNull().default(14),
  classDays: jsonb("class_days").$type<number[]>().notNull().default([2, 5, 0]),
  defaultPassMark: integer("default_pass_mark").notNull().default(70),
  status: varchar("status", { length: 24 }).$type<"draft" | "published" | "archived">().notNull().default("draft"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt,
  updatedAt,
}, (table) => [
  uniqueIndex("programs_org_slug_unique").on(table.organizationId, table.slug),
  index("programs_org_status_idx").on(table.organizationId, table.status),
]);

export const phases = pgTable("phases", {
  id: uuid("id").primaryKey().defaultRandom(),
  programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  outcome: text("outcome").notNull(),
  position: integer("position").notNull(),
  createdAt,
  updatedAt,
}, (table) => [
  uniqueIndex("phases_program_position_unique").on(table.programId, table.position),
]);

export const lessons = pgTable("lessons", {
  id: uuid("id").primaryKey().defaultRandom(),
  phaseId: uuid("phase_id").notNull().references(() => phases.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 240 }).notNull(),
  description: text("description").notNull(),
  learningObjectives: jsonb("learning_objectives").$type<string[]>().notNull().default([]),
  assignmentPrompt: text("assignment_prompt").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  position: integer("position").notNull(),
  releaseOffset: integer("release_offset").notNull(),
  passMark: integer("pass_mark").notNull().default(70),
  maximumAttempts: integer("maximum_attempts").notNull().default(3),
  status: varchar("status", { length: 24 }).$type<"draft" | "published" | "archived">().notNull().default("draft"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt,
  updatedAt,
}, (table) => [
  uniqueIndex("lessons_phase_position_unique").on(table.phaseId, table.position),
  index("lessons_phase_status_idx").on(table.phaseId, table.status),
]);

export const lessonAssets = pgTable("lesson_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  lessonId: uuid("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 24 }).$type<"video" | "slides" | "document" | "transcript" | "caption" | "worksheet">().notNull(),
  url: text("url").notNull(),
  pathname: text("pathname").notNull(),
  filename: varchar("filename", { length: 260 }).notNull(),
  contentType: varchar("content_type", { length: 160 }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  checksum: varchar("checksum", { length: 128 }),
  accessibilityLabel: varchar("accessibility_label", { length: 240 }),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
  createdAt,
}, (table) => [
  index("lesson_assets_lesson_kind_idx").on(table.lessonId, table.kind),
]);

export const cohorts = pgTable("cohorts", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  programId: uuid("program_id").notNull().references(() => programs.id),
  name: varchar("name", { length: 120 }).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  timezonePolicy: varchar("timezone_policy", { length: 24 }).$type<"learner" | "cohort">().notNull().default("learner"),
  cohortTimezone: varchar("cohort_timezone", { length: 80 }),
  status: varchar("status", { length: 24 }).$type<"draft" | "active" | "complete" | "archived">().notNull().default("draft"),
  capacity: integer("capacity"),
  createdAt,
  updatedAt,
}, (table) => [
  uniqueIndex("cohorts_org_name_unique").on(table.organizationId, table.name),
  index("cohorts_program_status_idx").on(table.programId, table.status),
]);

export const enrollments = pgTable("enrollments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  cohortId: uuid("cohort_id").notNull().references(() => cohorts.id),
  assignedStartDate: date("assigned_start_date").notNull(),
  timezone: varchar("timezone", { length: 80 }).notNull(),
  progressPercent: integer("progress_percent").notNull().default(0),
  status: varchar("status", { length: 24 }).$type<"active" | "paused" | "complete" | "withdrawn">().notNull().default("active"),
  pausedUntil: date("paused_until"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  enrolledBy: uuid("enrolled_by").references(() => users.id),
  createdAt,
  updatedAt,
}, (table) => [
  uniqueIndex("enrollments_user_cohort_unique").on(table.userId, table.cohortId),
  index("enrollments_org_cohort_status_idx").on(table.organizationId, table.cohortId, table.status),
]);

export const lessonProgress = pgTable("lesson_progress", {
  enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id, { onDelete: "cascade" }),
  lessonId: uuid("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 24 }).$type<"locked" | "available" | "in_progress" | "submitted" | "passed" | "changes_requested">().notNull().default("locked"),
  availableAt: timestamp("available_at", { withTimezone: true }),
  dueAt: timestamp("due_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  lectureCompletedAt: timestamp("lecture_completed_at", { withTimezone: true }),
  passedAt: timestamp("passed_at", { withTimezone: true }),
  playbackSeconds: integer("playback_seconds").notNull().default(0),
  percentViewed: integer("percent_viewed").notNull().default(0),
  updatedAt,
}, (table) => [
  primaryKey({ columns: [table.enrollmentId, table.lessonId] }),
  index("lesson_progress_status_due_idx").on(table.status, table.dueAt),
]);

export const assessments = pgTable("assessments", {
  id: uuid("id").primaryKey().defaultRandom(),
  lessonId: uuid("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 240 }).notNull(),
  instructions: text("instructions").notNull(),
  rubric: jsonb("rubric").$type<Array<{ criterion: string; points: number; description: string }>>().notNull().default([]),
  submissionType: varchar("submission_type", { length: 24 }).$type<"text" | "file" | "quiz" | "mixed">().notNull().default("mixed"),
  createdAt,
  updatedAt,
}, (table) => [
  uniqueIndex("assessments_lesson_unique").on(table.lessonId),
]);

export const assessmentQuestions = pgTable("assessment_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  assessmentId: uuid("assessment_id").notNull().references(() => assessments.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 24 }).$type<"multiple_choice" | "short_text" | "long_text">().notNull(),
  prompt: text("prompt").notNull(),
  options: jsonb("options").$type<string[]>(),
  answerKey: jsonb("answer_key"),
  points: integer("points").notNull(),
  position: integer("position").notNull(),
}, (table) => [
  uniqueIndex("assessment_questions_position_unique").on(table.assessmentId, table.position),
]);

export const submissions = pgTable("submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id, { onDelete: "cascade" }),
  lessonId: uuid("lesson_id").notNull().references(() => lessons.id),
  assessmentId: uuid("assessment_id").notNull().references(() => assessments.id),
  attempt: integer("attempt").notNull().default(1),
  responseText: text("response_text"),
  answers: jsonb("answers").$type<Record<string, unknown>>(),
  score: integer("score"),
  status: varchar("status", { length: 24 }).$type<"draft" | "submitted" | "in_review" | "passed" | "changes_requested">().notNull().default("draft"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt,
  updatedAt,
}, (table) => [
  uniqueIndex("submissions_enrollment_lesson_attempt_unique").on(table.enrollmentId, table.lessonId, table.attempt),
  index("submissions_org_status_submitted_idx").on(table.organizationId, table.status, table.submittedAt),
]);

export const submissionFiles = pgTable("submission_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  submissionId: uuid("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  pathname: text("pathname").notNull(),
  filename: varchar("filename", { length: 260 }).notNull(),
  contentType: varchar("content_type", { length: 160 }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt,
}, (table) => [
  index("submission_files_submission_idx").on(table.submissionId),
]);

export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  submissionId: uuid("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
  reviewerId: uuid("reviewer_id").notNull().references(() => users.id),
  decision: varchar("decision", { length: 24 }).$type<"passed" | "changes_requested">().notNull(),
  score: integer("score").notNull(),
  feedback: text("feedback").notNull(),
  rubricScores: jsonb("rubric_scores").$type<Record<string, number>>().notNull().default({}),
  createdAt,
}, (table) => [
  index("reviews_reviewer_created_idx").on(table.reviewerId, table.createdAt),
  uniqueIndex("reviews_submission_unique").on(table.submissionId),
]);

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 40 }).notNull(),
  title: varchar("title", { length: 240 }).notNull(),
  body: text("body").notNull(),
  actionUrl: text("action_url"),
  readAt: timestamp("read_at", { withTimezone: true }),
  emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
  createdAt,
}, (table) => [
  index("notifications_user_read_created_idx").on(table.userId, table.readAt, table.createdAt),
]);

export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  requesterId: uuid("requester_id").notNull().references(() => users.id),
  subject: varchar("subject", { length: 240 }).notNull(),
  category: varchar("category", { length: 40 }).notNull(),
  priority: varchar("priority", { length: 24 }).$type<"low" | "normal" | "high" | "urgent">().notNull().default("normal"),
  status: varchar("status", { length: 24 }).$type<"open" | "in_progress" | "waiting" | "resolved" | "closed">().notNull().default("open"),
  assignedTo: uuid("assigned_to").references(() => users.id),
  createdAt,
  updatedAt,
}, (table) => [
  index("support_tickets_org_status_priority_idx").on(table.organizationId, table.status, table.priority),
]);

export const supportMessages = pgTable("support_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id").notNull().references(() => supportTickets.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  createdAt,
}, (table) => [
  index("support_messages_ticket_created_idx").on(table.ticketId, table.createdAt),
]);

export const calendarEvents = pgTable("calendar_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  cohortId: uuid("cohort_id").references(() => cohorts.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 240 }).notNull(),
  description: text("description"),
  kind: varchar("kind", { length: 32 }).$type<"release" | "deadline" | "office_hours" | "live_session" | "panel">().notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  meetingUrl: text("meeting_url"),
  createdAt,
}, (table) => [
  index("calendar_events_cohort_starts_idx").on(table.cohortId, table.startsAt),
  index("calendar_events_user_starts_idx").on(table.userId, table.startsAt),
]);

export const certificates = pgTable("certificates", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id, { onDelete: "cascade" }),
  verificationCode: varchar("verification_code", { length: 48 }).notNull(),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
}, (table) => [
  uniqueIndex("certificates_enrollment_unique").on(table.enrollmentId),
  uniqueIndex("certificates_verification_code_unique").on(table.verificationCode),
]);

export const consentRecords = pgTable("consent_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  policy: varchar("policy", { length: 80 }).notNull(),
  version: varchar("version", { length: 40 }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
  ipHash: varchar("ip_hash", { length: 128 }),
}, (table) => [
  uniqueIndex("consent_records_user_policy_version_unique").on(table.userId, table.policy, table.version),
]);

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").references(() => users.id),
  action: varchar("action", { length: 120 }).notNull(),
  entityType: varchar("entity_type", { length: 80 }).notNull(),
  entityId: varchar("entity_id", { length: 120 }).notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  ipHash: varchar("ip_hash", { length: 128 }),
  userAgent: text("user_agent"),
  createdAt,
}, (table) => [
  index("audit_events_org_entity_idx").on(table.organizationId, table.entityType, table.entityId),
  index("audit_events_actor_created_idx").on(table.actorId, table.createdAt),
]);

export const emailOutbox = pgTable("email_outbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  to: varchar("to", { length: 320 }).notNull(),
  subject: varchar("subject", { length: 240 }).notNull(),
  template: varchar("template", { length: 80 }).notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  status: varchar("status", { length: 24 }).$type<"pending" | "sent" | "failed">().notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt,
}, (table) => [
  index("email_outbox_status_available_idx").on(table.status, table.availableAt),
]);

export const rateLimits = pgTable("rate_limits", {
  key: varchar("key", { length: 200 }).notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(1),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.key, table.windowStart] }),
  index("rate_limits_expires_idx").on(table.expiresAt),
]);

export type User = typeof users.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type Enrollment = typeof enrollments.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
