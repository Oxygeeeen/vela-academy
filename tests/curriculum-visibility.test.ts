import { describe, expect, it } from "vitest";
import { curriculumVisibility } from "@/lib/curriculum-visibility";

const phases = [
  { id: "phase-1", position: 1 },
  { id: "phase-2", position: 2 },
  { id: "phase-3", position: 3 },
];

describe("curriculum visibility", () => {
  it("reveals only the current lesson and conceals future phases", () => {
    const result = curriculumVisibility(phases, [
      { id: "lesson-1", phaseId: "phase-1", position: 1, status: "available" },
      { id: "lesson-2", phaseId: "phase-1", position: 2, status: "locked" },
      { id: "lesson-3", phaseId: "phase-2", position: 1, status: "locked" },
    ]);

    expect(result.phaseAccess.get("phase-1")).toBe("current");
    expect(result.phaseAccess.get("phase-2")).toBe("locked");
    expect(result.visibleLessonIds.has("lesson-1")).toBe(true);
    expect(result.visibleLessonIds.has("lesson-2")).toBe(false);
  });

  it("reveals a phase only after every prior lesson passes", () => {
    const result = curriculumVisibility(phases, [
      { id: "lesson-1", phaseId: "phase-1", position: 1, status: "passed" },
      { id: "lesson-2", phaseId: "phase-2", position: 1, status: "available" },
      { id: "lesson-3", phaseId: "phase-3", position: 1, status: "locked" },
    ]);

    expect(result.phaseAccess.get("phase-1")).toBe("completed");
    expect(result.phaseAccess.get("phase-2")).toBe("current");
    expect(result.phaseAccess.get("phase-3")).toBe("locked");
    expect([...result.visibleLessonIds]).toEqual(["lesson-1", "lesson-2"]);
  });
});
