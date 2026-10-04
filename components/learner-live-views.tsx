"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Check, ChevronRight, Clock3, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

type LivePhase = { id: string; title: string; description: string; outcome: string; position: number; accessState: "completed" | "current" | "locked" };
type LiveLesson = {
  id: string;
  phaseId: string;
  title: string;
  description: string;
  durationMinutes: number | null;
  position: number;
  releaseOffset: number;
  status: "locked" | "available" | "in_progress" | "submitted" | "passed" | "changes_requested";
  availableAt: string | null;
  dueAt: string | null;
  percentViewed: number;
};
type CurriculumData = {
  enrollment: {
    timezone: string;
    progressPercent: number;
    programTitle: string;
    programDescription: string;
    cohortName: string;
    assignedStartDate: string;
  };
  phases: LivePhase[];
  lessons: LiveLesson[];
  serverTime: string;
};
type CalendarEvent = { id: string; title: string; kind: string; startsAt: string; endsAt: string; description?: string | null };

function Heading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div>{eyebrow ? <p className="mb-2 text-sm font-semibold text-primary">{eyebrow}</p> : null}<h1 className="text-[clamp(1.9rem,3vw,2.75rem)] font-[730] tracking-[-0.045em]">{title}</h1><p className="mt-2 max-w-2xl text-base leading-7 text-muted-foreground">{description}</p></div>{action}</div>;
}

function useCurriculum() {
  const [data, setData] = useState<CurriculumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = () => fetch("/api/curriculum", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load your programme.");
        if (active) { setData(result); setError(null); }
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load your programme."); })
      .finally(() => { if (active) setLoading(false); });
    void refresh();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, []);
  return { data, loading, error };
}

function useCountdownTo(value: string | null | undefined) {
  const [label, setLabel] = useState("—");
  useEffect(() => {
    const tick = () => {
      if (!value) return setLabel("—");
      const delta = Math.max(0, new Date(value).getTime() - Date.now());
      const hours = Math.floor(delta / 3_600_000);
      const minutes = Math.floor((delta % 3_600_000) / 60_000);
      const seconds = Math.floor((delta % 60_000) / 1000);
      setLabel(`${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [value]);
  return label;
}

function EmptyProgramme({ message }: { message: string }) {
  return <section className="rounded-[22px] border bg-card p-12 text-center"><LockKeyhole className="mx-auto size-8 text-muted-foreground" /><h2 className="mt-5 text-xl font-semibold">No active programme yet</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{message}</p></section>;
}

export function LearnerOverviewLive({ learnerName, onCurriculum }: { learnerName: string; onCurriculum: () => void }) {
  const { data, loading, error } = useCurriculum();
  const [submissions, setSubmissions] = useState<Array<{ score: number | null; status: string; lessonTitle: string }>>([]);
  useEffect(() => {
    fetch("/api/submissions?pageSize=100", { cache: "no-store" }).then((response) => response.json()).then((result) => setSubmissions(result.data ?? [])).catch(() => undefined);
  }, []);
  const current = data?.lessons.find((lesson) => ["available", "in_progress", "changes_requested"].includes(lesson.status)) ?? null;
  const countdown = useCountdownTo(current?.dueAt);
  if (loading) return <div className="grid min-h-[50vh] place-items-center text-sm text-muted-foreground">Synchronising your programme…</div>;
  if (!data) return <><Heading eyebrow="Programme snapshot" title={`Welcome, ${learnerName.split(" ")[0]}.`} description="Your workspace is ready for a programme assignment." /><EmptyProgramme message={error ?? "Your administrator has not assigned an active programme. Once enrolled, your live schedule and curriculum will appear here."} /></>;

  const latestGraded = submissions.find((item) => item.score !== null);
  const waiting = submissions.filter((item) => ["submitted", "in_review"].includes(item.status)).length;
  return <>
    <Heading eyebrow="Live programme snapshot" title={`Welcome back, ${learnerName.split(" ")[0]}.`} description="Your next action, progression status, and upcoming learning windows are synchronised from your enrolment." action={<div className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays className="size-4" /> {data.enrollment.timezone}</div>} />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,.55fr)]">
      <article className="overflow-hidden rounded-[22px] border border-[#2845a8] bg-[#0d1b44] text-white shadow-[0_22px_60px_rgba(13,27,68,.18)]">
        <div className="grid min-h-[350px] md:grid-cols-[minmax(0,1fr)_230px]">
          <div className="flex flex-col p-6 sm:p-8">
            <div className="mb-9 flex items-center justify-between"><span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold">{current ? current.status.replaceAll("_", " ").toUpperCase() : "SCHEDULE COMPLETE"}</span><span className="text-sm text-white/60">{data.enrollment.cohortName}</span></div>
            <p className="mb-3 text-sm font-semibold text-[#91adff]">{data.enrollment.programTitle.toUpperCase()}</p>
            <h2 className="max-w-[620px] text-[clamp(1.75rem,3vw,2.6rem)] font-[700] leading-[1.08] tracking-[-0.04em]">{current?.title ?? "All currently available learning is complete"}</h2>
            <p className="mt-4 max-w-[600px] text-[15px] leading-6 text-white/67">{current?.description ?? "New sessions will appear here when their scheduled release and prerequisite conditions are satisfied."}</p>
            <div className="mt-auto flex flex-wrap items-center gap-3 pt-8"><Button onClick={onCurriculum} className="h-11 rounded-lg bg-white px-5 font-semibold text-[#0d1b44] hover:bg-white/90">{current ? "Open session" : "View curriculum"} <ChevronRight /></Button>{current ? <span className="flex items-center gap-2 text-sm text-white/60"><Clock3 className="size-4" /> {current.durationMinutes ?? "—"} min · {current.percentViewed}% viewed</span> : null}</div>
          </div>
          <div className="flex flex-col justify-between border-t border-white/10 bg-white/[.055] p-6 md:border-l md:border-t-0"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-white/50">{current ? "Submission window" : "Programme status"}</p><p className="mt-3 font-mono text-[2rem] font-semibold tracking-[-.05em]">{current ? countdown : `${data.enrollment.progressPercent}%`}</p><p className="mt-1 text-xs text-white/50">{current ? "remaining until the current deadline" : "overall completion"}</p></div><div className="space-y-3 text-sm text-white/70"><p>{data.lessons.filter((lesson) => lesson.status === "passed").length} sessions passed</p><p>{data.lessons.filter((lesson) => lesson.status === "locked").length} sessions locked</p><p>{waiting} submissions awaiting review</p></div></div>
        </div>
      </article>
      <aside className="rounded-[22px] border bg-card p-6 sm:p-7"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold">Programme progress</p><p className="mt-1 text-sm text-muted-foreground">Started {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(`${data.enrollment.assignedStartDate}T12:00:00Z`))}</p></div><span className="text-2xl font-[720] tracking-[-.04em]">{data.enrollment.progressPercent}%</span></div><Progress value={data.enrollment.progressPercent} className="mt-5 h-2" /><div className="mt-8 space-y-2">{data.phases.map((phase) => { const lessons = data.lessons.filter((lesson) => lesson.phaseId === phase.id); const passed = lessons.filter((lesson) => lesson.status === "passed").length; const locked = phase.accessState === "locked"; return <button key={phase.id} className={`module-row ${locked ? "cursor-not-allowed opacity-60" : ""}`} disabled={locked} aria-disabled={locked} onClick={locked ? undefined : onCurriculum}><span className={`grid size-8 place-items-center rounded-full text-xs font-bold ${passed === lessons.length && lessons.length ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-muted text-muted-foreground"}`}>{passed === lessons.length && lessons.length ? <Check className="size-4" /> : phase.position}</span><span className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-semibold">{String(phase.position).padStart(2, "0")} · {phase.title}</span><span className="text-xs text-muted-foreground">{passed}/{lessons.length} complete</span></span>{locked ? <LockKeyhole className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4" />}</button>; })}</div></aside>
    </div>
    <div className="mt-5 grid gap-5 md:grid-cols-3">{[["Next release", data.lessons.find((lesson) => lesson.status === "locked")?.availableAt ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.lessons.find((lesson) => lesson.status === "locked")!.availableAt!)) : "—", "Schedule and prerequisite governed"], ["Latest score", latestGraded?.score === null || latestGraded?.score === undefined ? "—" : `${latestGraded.score}%`, latestGraded?.lessonTitle ?? "No graded assessment yet"], ["Awaiting review", String(waiting), "Live reviewer queue status"]].map(([label, value, note]) => <article key={label} className="rounded-[18px] border bg-card p-5"><p className="text-xs font-semibold uppercase tracking-[.1em] text-muted-foreground">{label}</p><p className="mt-4 text-xl font-[700] tracking-[-.03em]">{value}</p><p className="mt-2 text-xs text-muted-foreground">{note}</p></article>)}</div>
  </>;
}

export function LearnerCalendarLive() {
  const { data, loading, error } = useCurriculum();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [month, setMonth] = useState(() => { const date = new Date(); return new Date(date.getFullYear(), date.getMonth(), 1); });
  useEffect(() => {
    fetch("/api/calendar", { cache: "no-store" }).then((response) => response.json()).then((result) => setEvents(result.data ?? [])).catch(() => undefined);
  }, []);
  const schedule = useMemo(() => {
    const lessonEvents = (data?.lessons ?? []).flatMap((lesson) => [
      ...(lesson.availableAt ? [{ id: `${lesson.id}:release`, title: lesson.title, kind: "release", startsAt: lesson.availableAt, endsAt: lesson.availableAt }] : []),
      ...(lesson.dueAt ? [{ id: `${lesson.id}:deadline`, title: `${lesson.title} deadline`, kind: "deadline", startsAt: lesson.dueAt, endsAt: lesson.dueAt }] : []),
    ]);
    return [...lessonEvents, ...events].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [data, events]);
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const leading = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((leading + days) / 7) * 7 }, (_, index) => index - leading + 1);
  const eventDays = new Set(schedule.filter((event) => { const date = new Date(event.startsAt); return date.getFullYear() === year && date.getMonth() === monthIndex; }).map((event) => new Date(event.startsAt).getDate()));
  const upcoming = schedule.filter((event) => new Date(event.startsAt) >= new Date()).slice(0, 12);
  if (loading) return <div className="grid min-h-[50vh] place-items-center text-sm text-muted-foreground">Synchronising schedule…</div>;
  if (!data) return <><Heading eyebrow="Timezone-aware schedule" title="Learning schedule" description="Programme dates will appear after enrolment." /><EmptyProgramme message={error ?? "Your administrator has not assigned a programme schedule yet."} /></>;
  return <>
    <Heading eyebrow={`Live schedule · ${data.enrollment.timezone}`} title="Learning schedule" description="Releases, deadlines, and academy events are calculated from current programme data and displayed in your timezone." action={<Button variant="outline" asChild><a href="/api/calendar.ics"><CalendarDays /> Add to calendar</a></Button>} />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="rounded-[20px] border bg-card p-6"><div className="mb-6 flex items-center justify-between"><h2 className="font-semibold">{new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(month)}</h2><div className="flex gap-1"><Button size="icon" variant="ghost" aria-label="Previous month" onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}><ArrowLeft /></Button><Button size="icon" variant="ghost" aria-label="Next month" onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}><ChevronRight /></Button></div></div><div className="grid grid-cols-7 text-center text-xs font-semibold text-muted-foreground">{["MON","TUE","WED","THU","FRI","SAT","SUN"].map((day) => <div key={day} className="py-2">{day}</div>)}</div><div className="calendar-grid">{cells.map((day, index) => { const current = day > 0 && day <= days; const today = current && new Date().toDateString() === new Date(year, monthIndex, day).toDateString(); return <div key={index} className={`calendar-day ${today ? "calendar-day-active" : ""}`}><span>{current ? day : ""}</span>{current && eventDays.has(day) ? <i /> : null}</div>; })}</div><div className="mt-5 flex flex-wrap gap-5 text-xs text-muted-foreground"><span className="flex items-center gap-2"><i className="size-2 rounded-full bg-primary" /> Live programme event</span><span>Updated {new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(new Date(data.serverTime))}</span></div></section>
      <aside className="rounded-[20px] border bg-card p-5"><h2 className="font-semibold">Upcoming</h2><div className="mt-5 space-y-2">{upcoming.length ? upcoming.map((event) => <div key={event.id} className="rounded-xl border p-3"><div className="flex items-center justify-between gap-3"><Badge variant="outline" className="capitalize">{event.kind.replaceAll("_", " ")}</Badge><span className="text-[11px] text-muted-foreground">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.startsAt))}</span></div><p className="mt-2 text-sm font-semibold leading-5">{event.title}</p></div>) : <p className="py-8 text-center text-sm text-muted-foreground">No upcoming releases or events.</p>}</div></aside>
    </div>
  </>;
}

type ProgramDetails = {
  program: { id: string; title: string; description: string; durationWeeks: number; status: string; defaultPassMark: number };
  accessState: "active" | "completed" | "locked";
  availableAt: string | null;
  phases: LivePhase[];
  lessons: Array<{ id: string; phaseId: string; title: string; durationMinutes: number | null; status: string }>;
};

export function ProgramDetailsDialog({ programId, onClose, onOpenCurriculum }: { programId: string | null; onClose: () => void; onOpenCurriculum: () => void }) {
  const [data, setData] = useState<ProgramDetails | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!programId) return;
    queueMicrotask(() => setLoading(true));
    fetch(`/api/programs/${programId}`, { cache: "no-store" }).then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Could not open the program."); setData(result); }).catch((error) => toast.error(error instanceof Error ? error.message : "Could not open the program.")).finally(() => setLoading(false));
  }, [programId]);
  return <Dialog open={Boolean(programId)} onOpenChange={(open) => !open && onClose()}><DialogContent className="sm:max-w-[720px]"><DialogHeader><DialogTitle className="text-2xl">{loading ? "Loading program…" : data?.program.title}</DialogTitle><DialogDescription>{data ? `${data.program.durationWeeks} weeks · ${data.program.defaultPassMark}% default pass mark` : "Synchronising access and curriculum details."}</DialogDescription></DialogHeader>{data ? data.accessState === "locked" ? <div className="rounded-2xl border bg-muted p-8 text-center"><LockKeyhole className="mx-auto size-8 text-muted-foreground" /><h3 className="mt-4 font-semibold">Program locked</h3><p className="mt-2 text-sm text-muted-foreground">{data.availableAt ? `Access opens ${new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeStyle: "short" }).format(new Date(data.availableAt))}.` : "This program is not yet published or available to your account."}</p></div> : <div className="space-y-5"><div className="rounded-xl bg-muted p-4"><div className="flex items-center justify-between"><Badge className="capitalize">{data.accessState}</Badge><span className="text-xs text-muted-foreground">{data.phases.length} phases · {data.lessons.length} sessions</span></div><p className="mt-3 text-sm leading-6 text-muted-foreground">{data.program.description}</p></div><div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">{data.phases.map((phase) => { const lessons = data.lessons.filter((lesson) => lesson.phaseId === phase.id); return <section key={phase.id} className="rounded-xl border p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-primary">Phase {phase.position}</p><h3 className="mt-1 font-semibold">{phase.title}</h3></div><span className="text-xs text-muted-foreground">{lessons.length} sessions</span></div></section>; })}</div><Button className="w-full" onClick={() => { onOpenCurriculum(); onClose(); }}>{data.accessState === "completed" ? "Review completed program" : "Open program"}</Button></div> : null}</DialogContent></Dialog>;
}
