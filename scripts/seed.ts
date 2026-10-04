import "../env-config";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import {
  assessments,
  cohorts,
  enrollments,
  lessonProgress,
  lessons,
  organizations,
  phases as phaseTable,
  programs,
  submissions,
  users,
} from "../db/schema";
import { phases as curriculum, students as sampleStudents } from "./demo-data";
import { hashPassword } from "../lib/auth/password";
import { lessonWindow } from "../lib/schedule";

const configuredAdminEmail = (process.env.BOOTSTRAP_ADMIN_EMAIL ?? "vela@scaleworkagency.com").toLowerCase();
const adminEmail = configuredAdminEmail === "admin@vela.academy" ? "vela@scaleworkagency.com" : configuredAdminEmail;
const demoAdminEmail = (process.env.BOOTSTRAP_DEMO_ADMIN_EMAIL ?? "demo.admin@vela.academy").toLowerCase();
function requiredSeedPassword(name: "BOOTSTRAP_ADMIN_PASSWORD" | "BOOTSTRAP_DEMO_ADMIN_PASSWORD" | "BOOTSTRAP_LEARNER_PASSWORD") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for deterministic, idempotent seeding.`);
  return value;
}
const adminPassword = requiredSeedPassword("BOOTSTRAP_ADMIN_PASSWORD");
const demoAdminPassword = requiredSeedPassword("BOOTSTRAP_DEMO_ADMIN_PASSWORD");
const learnerPassword = requiredSeedPassword("BOOTSTRAP_LEARNER_PASSWORD");

async function seed() {
  const [freshOrganization] = await db.insert(organizations).values({
    name: "Vela AI Academy",
    slug: "vela",
    defaultTimezone: "Africa/Lagos",
    defaultLocale: "en",
    primaryColor: "#2448c5",
  }).onConflictDoUpdate({
    target: organizations.slug,
    set: { name: "Vela AI Academy", updatedAt: new Date() },
  }).returning();

  const freshAdminHash = await hashPassword(adminPassword);
  await db.insert(users).values({
    organizationId: freshOrganization.id,
    email: adminEmail,
    fullName: "Enterprise Administrator",
    passwordHash: freshAdminHash,
    role: "owner",
    timezone: "Africa/Lagos",
    status: "active",
    mustChangePassword: false,
    emailVerifiedAt: new Date(),
  }).onConflictDoUpdate({
    target: [users.organizationId, users.email],
    set: { passwordHash: freshAdminHash, role: "owner", status: "active", updatedAt: new Date() },
  }).returning();

  const [organization] = await db.insert(organizations).values({
    name: "Vela Academy Executive Demo",
    slug: "vela-demo",
    defaultTimezone: "Africa/Lagos",
    defaultLocale: "en",
    primaryColor: "#2448c5",
  }).onConflictDoUpdate({
    target: organizations.slug,
    set: { name: "Vela Academy Executive Demo", updatedAt: new Date() },
  }).returning();

  const demoAdminHash = await hashPassword(demoAdminPassword);
  const [admin] = await db.insert(users).values({
    organizationId: organization.id,
    email: demoAdminEmail,
    fullName: "Demo Academy Administrator",
    passwordHash: demoAdminHash,
    role: "owner",
    timezone: "Africa/Lagos",
    status: "active",
    mustChangePassword: false,
    emailVerifiedAt: new Date(),
  }).onConflictDoUpdate({
    target: [users.organizationId, users.email],
    set: { passwordHash: demoAdminHash, role: "owner", status: "active", updatedAt: new Date() },
  }).returning();

  const [program] = await db.insert(programs).values({
    organizationId: organization.id,
    title: "Enterprise AI Trainer Certification",
    slug: "enterprise-ai-trainer",
    description: "A rigorous fourteen-week programme that prepares workplace educators to design, facilitate, govern, and measure responsible AI learning experiences.",
    durationWeeks: 14,
    classDays: [2, 5, 0],
    defaultPassMark: 70,
    status: "published",
    createdBy: admin.id,
  }).onConflictDoUpdate({
    target: [programs.organizationId, programs.slug],
    set: { status: "published", updatedAt: new Date() },
  }).returning();

  const existingPhases = await db.select().from(phaseTable).where(eq(phaseTable.programId, program.id));
  const createdPhases = existingPhases.length ? existingPhases : await db.insert(phaseTable).values(
    curriculum.map((phase, index) => ({
      programId: program.id,
      title: phase.name,
      description: phase.description,
      outcome: phase.outcome,
      position: index + 1,
      plannedLectureCount: phase.sessions.length,
    })),
  ).returning();

  const existingLessons = await db.select().from(lessons)
    .innerJoin(phaseTable, eq(phaseTable.id, lessons.phaseId))
    .where(eq(phaseTable.programId, program.id));
  const lessonRows = existingLessons.map((row) => row.lessons);
  if (!lessonRows.length) {
    let releaseOffset = 0;
    for (const phase of createdPhases.sort((a, b) => a.position - b.position)) {
      const blueprint = curriculum[phase.position - 1];
      const inserted = await db.insert(lessons).values(blueprint.sessions.map((session, index) => ({
        phaseId: phase.id,
        title: session.title,
        description: `${session.title} combines expert instruction, demonstrations, guided practice, reflection, and an applied enterprise scenario.`,
        learningObjectives: [
          `Explain the core principles behind ${session.title.toLowerCase()}.`,
          "Apply the method to a realistic workplace training scenario.",
          "Evaluate the result using responsible-AI and learning-design criteria.",
        ],
        assignmentPrompt: session.assignment,
        durationMinutes: index % 3 === 0 ? 110 : index % 3 === 1 ? 80 : 95,
        position: index + 1,
        releaseOffset: releaseOffset++,
        passMark: 70,
        maximumAttempts: 3,
        status: "published" as const,
        publishedAt: new Date(),
        createdBy: admin.id,
      }))).returning();
      lessonRows.push(...inserted);
    }
    await db.insert(assessments).values(lessonRows.map((lesson) => ({
      lessonId: lesson.id,
      title: `${lesson.title} assessment`,
      instructions: `${lesson.assignmentPrompt}. Submit a concise evidence-based response and any supporting artefacts. Your reviewer will assess relevance, accuracy, responsible practice, and transfer to the workplace.`,
      submissionType: "mixed" as const,
      rubric: [
        { criterion: "Application", points: 40, description: "Applies the lesson method to the scenario with clear evidence." },
        { criterion: "Accuracy", points: 35, description: "Uses accurate AI and learning-design concepts." },
        { criterion: "Responsible practice", points: 25, description: "Addresses risk, inclusion, privacy, and practical transfer." },
      ],
    })));
  }

  const cohortBlueprints = [
    { name: "Cohort 06", startDate: "2026-09-08", endDate: "2026-12-20" },
  ];
  const cohortRows = [];
  for (const cohort of cohortBlueprints) {
    const [record] = await db.insert(cohorts).values({
      organizationId: organization.id,
      programId: program.id,
      ...cohort,
      timezonePolicy: "learner",
      status: "active",
      capacity: 250,
    }).onConflictDoUpdate({
      target: [cohorts.organizationId, cohorts.name],
      set: { status: "active", updatedAt: new Date() },
    }).returning();
    cohortRows.push(record);
  }

  const learnerHash = await hashPassword(learnerPassword);
  for (const [index, sample] of sampleStudents.entries()) {
    const cohort = cohortRows.find((item) => item.name === sample.cohort)!;
    const [user] = await db.insert(users).values({
      organizationId: organization.id,
      email: sample.email.toLowerCase(),
      fullName: sample.name,
      passwordHash: learnerHash,
      role: "student",
      timezone: sample.timezone,
      status: "active",
      mustChangePassword: false,
      emailVerifiedAt: new Date(),
    }).onConflictDoUpdate({
      target: [users.organizationId, users.email],
      set: { passwordHash: learnerHash, timezone: sample.timezone, status: "active", updatedAt: new Date() },
    }).returning();
    const [enrollment] = await db.insert(enrollments).values({
      organizationId: organization.id,
      userId: user.id,
      cohortId: cohort.id,
      assignedStartDate: cohort.startDate,
      timezone: sample.timezone,
      progressPercent: sample.progress,
      enrolledBy: admin.id,
    }).onConflictDoUpdate({
      target: [enrollments.userId, enrollments.cohortId],
      set: { progressPercent: sample.progress, updatedAt: new Date() },
    }).returning();

    const passedCount = Math.floor((lessonRows.length * sample.progress) / 100);
    await db.insert(lessonProgress).values(lessonRows.map((lesson, lessonIndex) => {
      const window = lessonWindow(cohort.startDate, lesson.releaseOffset, sample.timezone, [2, 5, 0]);
      const passed = lessonIndex < passedCount;
      const next = lessonIndex === passedCount;
      return {
        enrollmentId: enrollment.id,
        lessonId: lesson.id,
        status: passed ? "passed" as const : next ? "available" as const : "locked" as const,
        availableAt: window.availableAt,
        dueAt: window.dueAt,
        startedAt: passed ? window.availableAt : null,
        lectureCompletedAt: passed ? window.availableAt : null,
        passedAt: passed ? new Date(window.availableAt.getTime() + 60 * 60_000) : null,
        playbackSeconds: passed ? lesson.durationMinutes * 60 : 0,
        percentViewed: passed ? 100 : 0,
      };
    })).onConflictDoNothing();

    if (index < 5 && lessonRows[passedCount]) {
      const lesson = lessonRows[passedCount];
      const [assessment] = await db.select().from(assessments).where(eq(assessments.lessonId, lesson.id)).limit(1);
      const exists = await db.select({ id: submissions.id }).from(submissions).where(and(
        eq(submissions.enrollmentId, enrollment.id),
        eq(submissions.lessonId, lesson.id),
      )).limit(1);
      if (!exists.length && assessment) {
        await db.insert(submissions).values({
          organizationId: organization.id,
          enrollmentId: enrollment.id,
          lessonId: lesson.id,
          assessmentId: assessment.id,
          attempt: 1,
          responseText: `Applied submission from ${sample.name}: a structured enterprise scenario, facilitator guidance, evidence plan, risk controls, and reflection aligned to the lesson outcomes.`,
          status: "submitted",
          submittedAt: new Date(Date.now() - (index + 3) * 60 * 60_000),
        });
        await db.update(lessonProgress).set({
          status: "submitted",
          startedAt: new Date(),
          lectureCompletedAt: new Date(),
          percentViewed: 100,
          playbackSeconds: lesson.durationMinutes * 60,
        }).where(and(
          eq(lessonProgress.enrollmentId, enrollment.id),
          eq(lessonProgress.lessonId, lesson.id),
        ));
      }
    }
  }

  console.info("Vela AI Academy seed complete.");
  console.info(`Fresh enterprise admin: ${adminEmail}`);
  console.info(`Demo admin: ${demoAdminEmail}`);
  console.info(`Demo learner: ${sampleStudents[0].email}`);
  console.info("Passwords were read from the bootstrap environment and are never printed.");
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
