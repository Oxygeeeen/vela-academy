import { describe, expect, it } from "vitest";
import { classDateForOffset, isValidTimezone, lessonWindow, progressionState } from "@/lib/schedule";

describe("timezone-aware learning schedule", () => {
  it("maps sequential releases to Tuesday, Friday, and Sunday", () => {
    expect(classDateForOffset("2026-09-08", 0)).toBe("2026-09-08");
    expect(classDateForOffset("2026-09-08", 1)).toBe("2026-09-11");
    expect(classDateForOffset("2026-09-08", 2)).toBe("2026-09-13");
    expect(classDateForOffset("2026-09-08", 3)).toBe("2026-09-15");
  });

  it("opens at midnight and closes immediately before the next release", () => {
    const window = lessonWindow("2026-09-08", 0, "Africa/Lagos");
    expect(window.availableAt.toISOString()).toBe("2026-09-07T23:00:00.000Z");
    expect(window.dueAt.toISOString()).toBe("2026-09-10T22:59:59.999Z");
  });

  it("keeps a scheduled lesson locked behind an incomplete prerequisite", () => {
    const state = progressionState({
      now: new Date("2026-09-12T12:00:00Z"),
      assignedStartDate: "2026-09-08",
      releaseOffset: 1,
      timezone: "Africa/Lagos",
      prerequisitePassed: false,
    });
    expect(state.state).toBe("prerequisite_locked");
  });

  it("validates IANA timezones", () => {
    expect(isValidTimezone("America/New_York")).toBe(true);
    expect(isValidTimezone("Mars/Olympus_Mons")).toBe(false);
  });
});
