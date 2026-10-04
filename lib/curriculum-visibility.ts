export type ProgressStatus = "locked" | "available" | "in_progress" | "submitted" | "passed" | "changes_requested";

export type VisibilityPhase = {
  id: string;
  position: number;
};

export type VisibilityLesson = {
  id: string;
  phaseId: string;
  position: number;
  status: ProgressStatus;
};

export type PhaseAccessState = "completed" | "current" | "locked";

export function curriculumVisibility(phases: VisibilityPhase[], lessons: VisibilityLesson[]) {
  const orderedPhases = [...phases].sort((a, b) => a.position - b.position);
  const phaseAccess = new Map<string, PhaseAccessState>();
  const visibleLessonIds = new Set<string>();
  let prerequisitesComplete = true;

  for (const phase of orderedPhases) {
    const phaseLessons = lessons
      .filter((lesson) => lesson.phaseId === phase.id)
      .sort((a, b) => a.position - b.position);
    const completed = phaseLessons.length > 0 && phaseLessons.every((lesson) => lesson.status === "passed");
    const accessState: PhaseAccessState = completed
      ? "completed"
      : prerequisitesComplete
        ? "current"
        : "locked";
    phaseAccess.set(phase.id, accessState);

    if (accessState !== "locked") {
      for (const lesson of phaseLessons) {
        if (lesson.status !== "locked") visibleLessonIds.add(lesson.id);
      }
    }
    prerequisitesComplete = prerequisitesComplete && completed;
  }

  return { phaseAccess, visibleLessonIds };
}
