import { describe, expect, it } from "vitest";
import { programAccessState } from "@/lib/program-access";

const enrollment = {
  status: "active" as const,
  progressPercent: 20,
  assignedStartDate: "2026-10-06",
  timezone: "Africa/Lagos",
};

describe("program access state", () => {
  it("keeps a draft program locked for staff", () => {
    expect(programAccessState({
      privileged: true,
      programStatus: "draft",
      classDays: [2, 5, 0],
    })).toBe("locked");
  });

  it("keeps an enrolled program locked before its local start day", () => {
    expect(programAccessState({
      privileged: false,
      programStatus: "published",
      classDays: [2, 5, 0],
      enrollment,
      now: new Date("2026-10-05T22:59:59Z"),
    })).toBe("locked");
  });

  it("opens an enrolled program at midnight in the learner timezone", () => {
    expect(programAccessState({
      privileged: false,
      programStatus: "published",
      classDays: [2, 5, 0],
      enrollment,
      now: new Date("2026-10-05T23:00:00Z"),
    })).toBe("active");
  });

  it("opens a completed program as completed regardless of schedule", () => {
    expect(programAccessState({
      privileged: false,
      programStatus: "archived",
      classDays: [2, 5, 0],
      enrollment: { ...enrollment, status: "complete", progressPercent: 100 },
      now: new Date("2026-01-01T00:00:00Z"),
    })).toBe("completed");
  });
});
