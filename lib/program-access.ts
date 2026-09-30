import { releaseInstant } from "@/lib/schedule";

export type ProgramAccessState = "active" | "completed" | "locked";

type ProgramAccessInput = {
  privileged: boolean;
  programStatus: "draft" | "published" | "archived";
  classDays: number[];
  enrollment?: {
    status: "active" | "paused" | "complete" | "withdrawn";
    progressPercent: number;
    assignedStartDate: string;
    timezone: string;
  } | null;
  now?: Date;
};

export function programAccessState(input: ProgramAccessInput): ProgramAccessState {
  if (input.privileged) {
    if (input.programStatus === "published") return "active";
    if (input.programStatus === "archived") return "completed";
    return "locked";
  }

  const enrollment = input.enrollment;
  if (!enrollment) return "locked";
  if (enrollment.status === "complete" || enrollment.progressPercent >= 100) return "completed";
  if (enrollment.status !== "active") return "locked";

  const availableAt = releaseInstant(
    enrollment.assignedStartDate,
    0,
    enrollment.timezone,
    input.classDays,
  );
  return (input.now ?? new Date()) >= availableAt ? "active" : "locked";
}
