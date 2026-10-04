"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  CloudUpload,
  FileCheck2,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Library,
  ListFilter,
  LockKeyhole,
  LogOut,
  Menu,
  MessageSquareText,
  MonitorPlay,
  Moon,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  SunMoon,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { upload } from "@vercel/blob/client";
import { BrandMark } from "@/components/brand-mark";
import { LearnerCalendarLive, LearnerOverviewLive, ProgramDetailsDialog } from "@/components/learner-live-views";
import { SupportCenter } from "@/components/support-center";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type Role = "learner" | "admin";
type LearnerView = "overview" | "curriculum" | "submissions" | "calendar" | "support";
type AdminView = "command" | "students" | "content" | "reviews" | "schedule" | "reports" | "support";
type ThemeMode = "auto" | "light" | "dark";
type ClientUser = {
  id: string;
  organizationId: string;
  email: string;
  fullName: string;
  role: "owner" | "admin" | "reviewer" | "trainer" | "student";
  timezone: string | null;
  locale: string;
  mustChangePassword: boolean;
};

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2);
}

function StatusPill({ status }: { status: string }) {
  const style =
    status === "On track" || status === "Approved" || status === "Passed"
      ? "status-success"
      : status === "Ahead"
        ? "status-info"
        : status === "Needs attention" || status === "Resubmission"
          ? "status-warning"
          : "status-neutral";
  return <span className={`status-pill ${style}`}>{status}</span>;
}

function ThemeMenu({ mode, setMode }: { mode: ThemeMode; setMode: (mode: ThemeMode) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Appearance">
          {mode === "dark" ? <Moon /> : mode === "light" ? <Sun /> : <SunMoon />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={mode} onValueChange={(value) => setMode(value as ThemeMode)}>
          <DropdownMenuRadioItem value="auto">Auto</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WorkspaceSearch({ role, onProgram, onNavigate }: { role: Role; onProgram: (id: string) => void; onNavigate: (type: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ id: string; type: string; title: string; url: string; email?: string; description?: string; accessState?: "active" | "completed" | "locked"; availableAt?: string | null }>>([]);
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal, cache: "no-store" })
        .then((response) => response.json())
        .then((result) => setResults(result.data ?? []))
        .catch(() => undefined);
    }, 200);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query]);
  return (
    <div className="relative hidden md:block">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
        <Search className="size-4" />
        <label htmlFor="workspace-search" className="sr-only">Search workspace</label>
        <input id="workspace-search" value={query} onChange={(event) => setQuery(event.target.value)} className="w-64 bg-transparent text-foreground outline-none placeholder:text-muted-foreground" placeholder={role === "learner" ? "Search your programme" : "Search people, content, support"} />
      </div>
      {results.length ? <div className="absolute left-0 top-12 z-50 w-[390px] overflow-hidden rounded-xl border bg-popover p-2 shadow-xl">{results.map((result) => <button type="button" key={`${result.type}:${result.id}`} onClick={() => { setQuery(""); setResults([]); if (result.type === "program") onProgram(result.id); else { window.history.replaceState({}, "", result.url); onNavigate(result.type); } }} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-muted"><span className="flex items-center justify-between gap-3"><span className="text-[10px] font-bold uppercase tracking-wider text-primary">{result.type}</span>{result.accessState ? <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{result.accessState === "locked" ? <LockKeyhole className="size-3" /> : result.accessState === "completed" ? <CheckCircle2 className="size-3 text-[var(--success)]" /> : null}{result.accessState}</span> : null}</span><span className="mt-0.5 block truncate text-sm font-semibold">{result.title}</span>{result.email ? <span className="block truncate text-xs text-muted-foreground">{result.email}</span> : result.description ? <span className="mt-1 block truncate text-xs text-muted-foreground">{result.description}</span> : null}{result.accessState === "locked" && result.availableAt ? <span className="mt-1 block text-[11px] text-muted-foreground">Opens {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(result.availableAt))}</span> : null}</button>)}</div> : null}
    </div>
  );
}

function NotificationMenu() {
  const [items, setItems] = useState<Array<{ id: string; title: string; body: string; readAt: string | null; actionUrl: string | null }>>([]);
  const [unread, setUnread] = useState(0);
  const load = async () => {
    const response = await fetch("/api/notifications?pageSize=8", { cache: "no-store" });
    if (!response.ok) return;
    const result = await response.json();
    setItems(result.data ?? []);
    setUnread(result.unread ?? 0);
  };
  useEffect(() => { void load(); }, []);

  async function markRead(id?: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(id ? { id } : { markAllRead: true }),
    });
    await load();
  }

  return (
    <DropdownMenu onOpenChange={(open) => open && void load()}>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Notifications, ${unread} unread`} className="relative"><Bell />{unread ? <span className="absolute right-2 top-2 size-1.5 rounded-full bg-[#e15353]" /> : null}</Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px]">
        <div className="flex items-center justify-between px-2 py-1.5"><DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>{unread ? <button className="text-xs font-semibold text-primary" onClick={() => markRead()}>Mark all read</button> : null}</div>
        <DropdownMenuSeparator />
        {items.length ? items.map((item) => <DropdownMenuItem key={item.id} className="block cursor-pointer py-3" onClick={() => { void markRead(item.id); if (item.actionUrl) window.location.href = item.actionUrl; }}><span className="flex items-center gap-2 text-sm font-semibold">{!item.readAt ? <i className="size-1.5 rounded-full bg-primary" /> : null}{item.title}</span><span className="mt-1 block whitespace-normal text-xs leading-5 text-muted-foreground">{item.body}</span></DropdownMenuItem>) : <p className="px-3 py-6 text-center text-sm text-muted-foreground">You’re all caught up.</p>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SupportDialog() {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("technical");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("vela:support", show);
    return () => window.removeEventListener("vela:support", show);
  }, []);
  async function submit() {
    setSaving(true);
    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject, category, message, priority: "normal" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not create support ticket.");
      toast.success("Support ticket created. Your academy team has been notified.");
      window.dispatchEvent(new Event("vela:support-created"));
      setOpen(false);
      setSubject("");
      setMessage("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create support ticket.");
    } finally {
      setSaving(false);
    }
  }
  return <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Contact academy support</DialogTitle><DialogDescription>Send a tracked request to your programme team. Accessibility requests are prioritised.</DialogDescription></DialogHeader><div className="space-y-4 py-2"><div className="space-y-2"><Label htmlFor="support-subject">Subject</Label><Input id="support-subject" value={subject} onChange={(event) => setSubject(event.target.value)} /></div><div className="space-y-2"><Label>Category</Label><Select value={category} onValueChange={setCategory}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="technical">Technical</SelectItem><SelectItem value="curriculum">Curriculum</SelectItem><SelectItem value="assessment">Assessment</SelectItem><SelectItem value="account">Account</SelectItem><SelectItem value="accessibility">Accessibility</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label htmlFor="support-message">How can we help?</Label><Textarea id="support-message" className="min-h-32" value={message} onChange={(event) => setMessage(event.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={saving || subject.length < 5 || message.length < 10} onClick={submit}>{saving ? "Sending…" : "Create ticket"}</Button></DialogFooter></DialogContent></Dialog>;
}

function RequiredPasswordChange({ user, onSignedOut }: { user: ClientUser; onSignedOut: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  if (!user.mustChangePassword) return null;
  async function updatePassword() {
    if (newPassword !== confirmation) return toast.error("The new passwords do not match.");
    setSaving(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Password could not be changed.");
      toast.success("Password changed. Sign in again with your new password.");
      onSignedOut();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Password could not be changed.");
    } finally {
      setSaving(false);
    }
  }
  return <Dialog open onOpenChange={() => undefined}><DialogContent onInteractOutside={(event) => event.preventDefault()} className="sm:max-w-[480px]"><DialogHeader><DialogTitle>Create your private password</DialogTitle><DialogDescription>Your administrator-issued password is temporary. Replace it before entering the learning workspace.</DialogDescription></DialogHeader><div className="space-y-4 py-2"><div className="space-y-2"><Label htmlFor="current-password">Temporary password</Label><Input id="current-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" /></div><div className="space-y-2"><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" /><p className="text-xs leading-5 text-muted-foreground">Use at least 14 characters with uppercase, lowercase, number, and symbol.</p></div><div className="space-y-2"><Label htmlFor="confirm-password">Confirm new password</Label><Input id="confirm-password" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" /></div></div><DialogFooter><Button disabled={saving || !currentPassword || !newPassword || !confirmation} onClick={updatePassword}>{saving ? "Securing account…" : "Change password"}</Button></DialogFooter></DialogContent></Dialog>;
}

function PasswordRecoveryDialog({ open, onOpenChange, initialEmail }: { open: boolean; onOpenChange: (open: boolean) => void; initialEmail: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (open && initialEmail) setEmail(initialEmail);
  }, [open, initialEmail]);

  async function requestReset(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Password reset instructions could not be sent.");
      setSent(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Password reset instructions could not be sent.");
    } finally {
      setSending(false);
    }
  }

  return <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) setSent(false); }}><DialogContent className="sm:max-w-[470px]">{sent ? <><DialogHeader><div className="mb-2 grid size-11 place-items-center rounded-full bg-[var(--success-soft)] text-[var(--success)]"><CheckCircle2 className="size-5" /></div><DialogTitle>Check your email</DialogTitle><DialogDescription>If an active Vela Academy account matches <strong className="font-semibold text-foreground">{email}</strong>, a secure one-time link has been sent. It expires in 60 minutes.</DialogDescription></DialogHeader><div className="rounded-xl border bg-muted/50 p-4 text-sm leading-6 text-muted-foreground">Didn’t receive it? Check spam, confirm the address, or contact <a className="font-semibold text-primary" href="mailto:vela@scaleworkagency.com">vela@scaleworkagency.com</a>.</div><DialogFooter><Button onClick={() => onOpenChange(false)}>Return to sign in</Button></DialogFooter></> : <form onSubmit={requestReset}><DialogHeader><DialogTitle>Reset your password</DialogTitle><DialogDescription>Enter your registered email. We’ll send a secure, one-time password reset link.</DialogDescription></DialogHeader><div className="space-y-2 py-5"><Label htmlFor="recovery-email">Email address</Label><Input id="recovery-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={sending || !email}>{sending ? "Sending securely…" : "Send reset link"}</Button></DialogFooter></form>}</DialogContent></Dialog>;
}

function PasswordResetFromLink() {
  const [token, setToken] = useState("");
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [valid, setValid] = useState(false);
  const [error, setError] = useState("");
  const [emailHint, setEmailHint] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    const resetToken = new URLSearchParams(window.location.search).get("reset_token");
    if (!resetToken) return;
    setToken(resetToken);
    setOpen(true);
    setChecking(true);
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(resetToken)}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "This password reset link is invalid or has expired.");
        setValid(true);
        setEmailHint(result.emailHint ?? "");
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "This password reset link is invalid or has expired."))
      .finally(() => setChecking(false));
  }, []);

  async function resetPassword(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmation) {
      setError("The new passwords do not match.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Your password could not be reset.");
      setComplete(true);
      setValid(false);
      window.history.replaceState({}, "", window.location.pathname);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your password could not be reset.");
    } finally {
      setSaving(false);
    }
  }

  return <Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-[480px]">{complete ? <><DialogHeader><div className="mb-2 grid size-11 place-items-center rounded-full bg-[var(--success-soft)] text-[var(--success)]"><CheckCircle2 className="size-5" /></div><DialogTitle>Password changed</DialogTitle><DialogDescription>Your password has been updated, existing sessions were signed out, and a confirmation email was sent. You can now sign in with your new password.</DialogDescription></DialogHeader><DialogFooter><Button onClick={() => setOpen(false)}>Continue to sign in</Button></DialogFooter></> : checking ? <div className="py-10 text-center text-sm text-muted-foreground">Checking your secure reset link…</div> : !valid ? <><DialogHeader><DialogTitle>Reset link unavailable</DialogTitle><DialogDescription>{error || "This password reset link is invalid or has expired."}</DialogDescription></DialogHeader><div className="rounded-xl border bg-muted/50 p-4 text-sm text-muted-foreground">Request a new link from the sign-in page or contact <a className="font-semibold text-primary" href="mailto:vela@scaleworkagency.com">vela@scaleworkagency.com</a>.</div><DialogFooter><Button onClick={() => setOpen(false)}>Return to sign in</Button></DialogFooter></> : <form onSubmit={resetPassword}><DialogHeader><DialogTitle>Create a new password</DialogTitle><DialogDescription>Secure the account for {emailHint}. The link can only be used once.</DialogDescription></DialogHeader><div className="space-y-4 py-5"><div className="space-y-2"><Label htmlFor="reset-new-password">New password</Label><Input id="reset-new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" required /><p className="text-xs leading-5 text-muted-foreground">Use at least 14 characters with uppercase, lowercase, number, and symbol.</p></div><div className="space-y-2"><Label htmlFor="reset-confirm-password">Confirm new password</Label><Input id="reset-confirm-password" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" required /></div>{error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}</div><DialogFooter><Button type="submit" disabled={saving || !newPassword || !confirmation}>{saving ? "Securing account…" : "Change password"}</Button></DialogFooter></form>}</DialogContent></Dialog>;
}

function LoginScreen({
  onLogin,
  theme,
  setTheme,
}: {
  onLogin: (user: ClientUser) => void;
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    // Prevent a server-rendered control from accepting a click before React hydration completes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInteractive(true);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Sign-in failed.");
      const profile = await fetch("/api/auth/me", { cache: "no-store" });
      const current = await profile.json();
      if (!profile.ok) throw new Error(current.error ?? "Could not load your account.");
      onLogin(current.user);
      toast.success("Welcome back to Vela Academy");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Sign-in failed.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <div className="absolute right-5 top-5"><ThemeMenu mode={theme} setMode={setTheme} /></div>
      <section className="login-brand">
        <div className="relative z-10 max-w-xl">
          <div className="mb-12 flex items-center gap-3">
            <div className="rounded-xl bg-white p-1"><BrandMark size={32} /></div>
            <span className="text-lg font-bold">Vela Academy</span>
          </div>
          <p className="mb-4 text-sm font-bold uppercase tracking-[.14em] text-[#9db1ff]">AI Trainer Certification</p>
          <h1 className="text-[clamp(2.7rem,5vw,5rem)] font-[740] leading-[.98] tracking-[-.06em]">Teach AI with clarity, confidence, and care.</h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-white/65">A 14-week enterprise programme for the people responsible for turning AI ambition into real capability.</p>
        </div>
        <div className="login-grid" aria-hidden="true" />
        <div className="relative z-10 grid grid-cols-3 gap-6 text-sm text-white/60">
          <div><strong className="block text-xl text-white">42</strong>guided sessions</div>
          <div><strong className="block text-xl text-white">3×</strong>weekly cadence</div>
          <div><strong className="block text-xl text-white">1</strong>verified capstone</div>
        </div>
      </section>
      <section className="login-panel">
        <form onSubmit={submit} className="w-full max-w-[430px]">
          <div className="mb-9 lg:hidden">
            <BrandMark size={40} className="mb-6" />
          </div>
          <p className="text-sm font-semibold text-primary">Welcome back</p>
          <h2 className="mt-2 text-3xl font-[720] tracking-[-.04em]">Sign in to continue</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Use the email registered by your programme administrator.</p>
          <div className="mt-8 space-y-5">
            <div className="space-y-2"><Label htmlFor="email">Email address</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" required /></div>
            <div className="space-y-2"><div className="flex justify-between"><Label htmlFor="password">Password</Label><button type="button" disabled={!interactive} className="text-xs font-semibold text-primary disabled:cursor-wait disabled:opacity-60" onClick={() => setRecoveryOpen(true)}>Reset password</button></div><Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" required /></div>
          </div>
          {error ? <p role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={submitting} className="mt-7 h-11 w-full rounded-lg">{submitting ? "Signing in…" : "Sign in securely"}</Button>
          <div className="mt-6 rounded-xl border border-border bg-muted/55 p-4 text-xs leading-5 text-muted-foreground">
            <p className="font-semibold text-foreground">Executive demo access</p>
            <p className="mt-1">Demo learner: amara.diallo@northstar.io</p>
            <p>Demo administrator: demo.admin@vela.academy</p>
            <p className="mt-1">The separate vela@scaleworkagency.com account starts with an empty enterprise workspace.</p>
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground">Protected learning environment · <a className="font-semibold hover:text-primary" href="mailto:vela@scaleworkagency.com">vela@scaleworkagency.com</a></p>
        </form>
      </section>
      <PasswordRecoveryDialog open={recoveryOpen} onOpenChange={setRecoveryOpen} initialEmail={email} />
      <PasswordResetFromLink />
    </main>
  );
}

function Navigation({
  role,
  learnerView,
  adminView,
  setLearnerView,
  setAdminView,
}: {
  role: Role;
  learnerView: LearnerView;
  adminView: AdminView;
  setLearnerView: (view: LearnerView) => void;
  setAdminView: (view: AdminView) => void;
  mobile?: boolean;
}) {
  const learnerItems: { id: LearnerView; label: string; icon: ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <LayoutDashboard /> },
    { id: "curriculum", label: "Curriculum", icon: <BookOpen /> },
    { id: "submissions", label: "Submissions", icon: <GraduationCap /> },
    { id: "calendar", label: "Schedule", icon: <CalendarDays /> },
    { id: "support", label: "Support", icon: <MessageSquareText /> },
  ];
  const adminItems: { id: AdminView; label: string; icon: ReactNode; count?: number }[] = [
    { id: "command", label: "Command centre", icon: <LayoutDashboard /> },
    { id: "students", label: "Students", icon: <Users /> },
    { id: "content", label: "Curriculum", icon: <Library /> },
    { id: "reviews", label: "Reviews", icon: <FileCheck2 /> },
    { id: "schedule", label: "Release schedule", icon: <CalendarDays /> },
    { id: "reports", label: "Reports", icon: <BarChart3 /> },
    { id: "support", label: "Support", icon: <MessageSquareText /> },
  ];
  const items = role === "learner" ? learnerItems : adminItems;

  return (
    <nav aria-label="Primary" className="space-y-1">
      {items.map((item) => {
        const active = role === "learner" ? learnerView === item.id : adminView === item.id;
        return (
          <button
            key={item.id}
            className={`nav-item ${active ? "nav-item-active" : ""}`}
            onClick={() => role === "learner" ? setLearnerView(item.id as LearnerView) : setAdminView(item.id as AdminView)}
          >
            <span className="[&_svg]:size-[18px]">{item.icon}</span>
            <span className="flex-1 text-left">{item.label}</span>
            {"count" in item && item.count ? <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">{item.count}</span> : null}
          </button>
        );
      })}
    </nav>
  );
}

function AppSidebar(props: {
  role: Role;
  learnerView: LearnerView;
  adminView: AdminView;
  setLearnerView: (view: LearnerView) => void;
  setAdminView: (view: AdminView) => void;
  onRole: (role: Role) => void;
  onLogout: () => void;
  user: ClientUser;
  canAdmin: boolean;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-border bg-sidebar px-4 py-5 lg:flex lg:flex-col">
      <div className="mb-9 flex items-center gap-3 px-2">
        <BrandMark size={36} />
        <div><p className="text-[15px] font-[720] tracking-[-.02em]">Vela Academy</p><p className="text-xs text-muted-foreground">{props.role === "learner" ? "AI Trainer Program" : "Programme operations"}</p></div>
      </div>
      <Navigation {...props} />
      <div className="mt-auto border-t border-border pt-4">
        <a className="nav-item" href="https://www.scaleworkagency.com/legal/privacy" target="_blank" rel="noreferrer"><Settings className="size-[18px]" /><span>Privacy & data</span></a>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="mt-4 flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left">
              <div className="grid size-9 place-items-center rounded-full bg-[#dfe7ff] text-sm font-bold text-[#2448a6]">{initials(props.user.fullName)}</div>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{props.user.fullName}</p><p className="truncate text-xs text-muted-foreground">{props.role === "learner" ? "Learner workspace" : `${props.user.role} workspace`}</p></div>
              <ChevronDown className="size-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-[216px]">
            <DropdownMenuLabel>{props.user.email}</DropdownMenuLabel>
            {props.canAdmin ? <><DropdownMenuItem onClick={() => props.onRole(props.role === "learner" ? "admin" : "learner")}><ShieldCheck /> Preview {props.role === "learner" ? "admin" : "learner"} workspace</DropdownMenuItem><DropdownMenuSeparator /></> : null}
            <DropdownMenuItem asChild><a href="https://www.scaleworkagency.com/legal/privacy" target="_blank" rel="noreferrer"><Settings /> Privacy &amp; data</a></DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={props.onLogout}><LogOut /> Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}

function AppHeader({
  role,
  theme,
  setTheme,
  mobileNavigation,
  onRole,
  onLogout,
  onProgram,
  onNavigate,
  onSupport,
  user,
  canAdmin,
}: {
  role: Role;
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  mobileNavigation: ReactNode;
  onRole: (role: Role) => void;
  onLogout: () => void;
  onProgram: (id: string) => void;
  onNavigate: (type: string) => void;
  onSupport: () => void;
  user: ClientUser;
  canAdmin: boolean;
}) {
  const [systemHealthy, setSystemHealthy] = useState<boolean | null>(null);
  useEffect(() => {
    const check = () => fetch("/api/health", { cache: "no-store" }).then((response) => setSystemHealthy(response.ok)).catch(() => setSystemHealthy(false));
    void check();
    const timer = window.setInterval(check, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-border bg-background/88 px-5 backdrop-blur-xl sm:px-8 lg:px-10">
      <div className="flex items-center gap-3">
        {mobileNavigation}
        <WorkspaceSearch role={role} onProgram={onProgram} onNavigate={onNavigate} />
      </div>
      <div className="flex items-center gap-2">
        <div className={`hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold sm:flex ${systemHealthy === false ? "bg-destructive/10 text-destructive" : "bg-[var(--success-soft)] text-[var(--success)]"}`}><span className="size-1.5 rounded-full bg-current" /> {systemHealthy === null ? "Checking live services" : systemHealthy ? "Live services synced" : "Service attention needed"}</div>
        <ThemeMenu mode={theme} setMode={setTheme} />
        <NotificationMenu />
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Account menu"><span className="grid size-8 place-items-center rounded-full bg-[#dfe7ff] text-[11px] font-bold text-[#2448a6]">{initials(user.fullName)}</span></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60"><DropdownMenuLabel><span className="block">{user.fullName}</span><span className="block truncate text-xs font-normal text-muted-foreground">{user.email}</span></DropdownMenuLabel>{canAdmin ? <DropdownMenuItem onClick={() => onRole(role === "learner" ? "admin" : "learner")}><ShieldCheck /> Preview {role === "learner" ? "admin" : "learner"} workspace</DropdownMenuItem> : null}<DropdownMenuSeparator /><DropdownMenuItem asChild><a href="https://www.scaleworkagency.com/legal/privacy" target="_blank" rel="noreferrer"><Settings /> Privacy &amp; data</a></DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={onLogout}><LogOut /> Sign out</DropdownMenuItem></DropdownMenuContent>
        </DropdownMenu>
        <Button variant="outline" size="sm" className="hidden rounded-lg sm:inline-flex" onClick={onSupport}>{role === "learner" ? "Help centre" : "Operations support"}</Button>
      </div>
    </header>
  );
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div>{eyebrow ? <p className="mb-2 text-sm font-semibold text-primary">{eyebrow}</p> : null}<h1 className="text-[clamp(1.9rem,3vw,2.75rem)] font-[730] tracking-[-0.045em]">{title}</h1><p className="mt-2 max-w-2xl text-base leading-7 text-muted-foreground">{description}</p></div>
      {action}
    </div>
  );
}

type LivePhase = { id: string; title: string; description: string; outcome: string; position: number };
type LiveLesson = {
  id: string;
  phaseId: string;
  title: string;
  description: string;
  learningObjectives: string[];
  assignmentPrompt: string;
  durationMinutes: number;
  position: number;
  status: "locked" | "available" | "in_progress" | "submitted" | "passed" | "changes_requested";
  availableAt: string | null;
  dueAt: string | null;
  lectureCompletedAt: string | null;
  percentViewed: number;
};
type LiveAsset = { id: string; lessonId: string; kind: string; url: string; filename: string; accessibilityLabel: string | null };

function LiveCurriculumView() {
  const [data, setData] = useState<{ enrollment: { timezone: string; progressPercent: number; programTitle: string }; phases: LivePhase[]; lessons: LiveLesson[]; assets: LiveAsset[] } | null>(null);
  const [selected, setSelected] = useState<LiveLesson | null>(null);
  const [responseText, setResponseText] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/curriculum", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not load your curriculum.");
      setData(result);
      if (selected) setSelected(result.lessons.find((lesson: LiveLesson) => lesson.id === selected.id) ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load your curriculum.");
    } finally {
      setLoading(false);
    }
  };
  // The initial fetch intentionally runs once; later mutations call load directly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, []);

  async function updateProgress(lesson: LiveLesson, action: "start" | "complete_lecture") {
    const response = await fetch(`/api/progress/${lesson.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, percentViewed: action === "complete_lecture" ? 100 : lesson.percentViewed, playbackSeconds: action === "complete_lecture" ? lesson.durationMinutes * 60 : 0 }),
    });
    const result = await response.json();
    if (!response.ok) return toast.error(result.error ?? "Progress could not be updated.");
    toast.success(action === "complete_lecture" ? "Lecture complete. The assessment is now available." : "Learning session started.");
    await load();
  }

  async function submitAssessment() {
    if (!selected || responseText.trim().length < 20) return toast.error("Add a substantive assessment response.");
    const response = await fetch("/api/submissions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lessonId: selected.id, responseText }),
    });
    const result = await response.json();
    if (!response.ok) return toast.error(result.error ?? "Submission failed.");
    toast.success("Assessment submitted for review.");
    setResponseText("");
    setSelected(null);
    await load();
  }

  if (loading && !data) return <div className="grid min-h-[50vh] place-items-center text-sm text-muted-foreground">Loading your scheduled curriculum…</div>;
  if (!data) return <div className="rounded-2xl border bg-card p-8 text-center"><h2 className="font-semibold">Curriculum unavailable</h2><p className="mt-2 text-sm text-muted-foreground">Contact academy support if your enrolment should be active.</p></div>;

  return (
    <>
      <PageHeading eyebrow={`${data.lessons.length} sessions · ${data.enrollment.progressPercent}% complete`} title={data.enrollment.programTitle} description="Learning opens at 00:00 in your timezone. Each next session requires both its scheduled release and a passing review." action={<div className="rounded-full border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground">Timezone · {data.enrollment.timezone}</div>} />
      <Tabs defaultValue={data.phases[0]?.id}>
        <TabsList variant="line" className="scrollbar-none mb-6 w-full justify-start overflow-x-auto border-b">{data.phases.map((phase) => <TabsTrigger key={phase.id} value={phase.id} className="min-w-max px-4 py-3">0{phase.position} · {phase.title}</TabsTrigger>)}</TabsList>
        {data.phases.map((phase) => <TabsContent key={phase.id} value={phase.id}><section className="mb-5 grid gap-5 rounded-[20px] border bg-card p-6 lg:grid-cols-[1.2fr_.8fr]"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-primary">Phase {phase.position}</p><h2 className="mt-2 text-2xl font-[700] tracking-[-.035em]">{phase.title}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{phase.description}</p></div><div className="rounded-xl bg-muted p-4"><p className="text-xs font-bold uppercase tracking-[.1em] text-muted-foreground">Phase outcome</p><p className="mt-2 text-sm font-medium leading-6">{phase.outcome}</p></div></section><div className="overflow-hidden rounded-[20px] border bg-card">{data.lessons.filter((lesson) => lesson.phaseId === phase.id).map((lesson, index) => { const locked = lesson.status === "locked"; const complete = lesson.status === "passed"; return <div key={lesson.id} className={`grid gap-4 p-5 sm:grid-cols-[44px_minmax(0,1fr)_auto] sm:items-center ${index ? "border-t" : ""} ${!locked && !complete ? "bg-accent/55" : ""}`}><div className={`grid size-10 place-items-center rounded-full border text-xs font-bold ${complete ? "border-transparent bg-[var(--success-soft)] text-[var(--success)]" : !locked ? "border-primary bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{complete ? <Check className="size-4" /> : locked ? <LockKeyhole className="size-3.5" /> : String(lesson.position).padStart(2, "0")}</div><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{lesson.title}</h3><StatusPill status={lesson.status.replaceAll("_", " ")} /></div><div className="mt-1.5 flex flex-wrap gap-x-4 text-xs text-muted-foreground"><span>{lesson.durationMinutes} min</span><span>{lesson.availableAt ? `Opens ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(lesson.availableAt))}` : "Release pending"}</span><span>{lesson.dueAt ? `Due ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(lesson.dueAt))}` : ""}</span></div><p className="mt-2 text-sm text-muted-foreground">Assignment · {lesson.assignmentPrompt}</p></div><Button variant={!locked && !complete ? "default" : "ghost"} size="sm" disabled={locked} onClick={() => { setSelected(lesson); if (lesson.status === "available") void updateProgress(lesson, "start"); }}>{complete ? "Review" : locked ? "Locked" : "Open session"}</Button></div>; })}</div></TabsContent>)}
      </Tabs>
      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>{selected ? <SheetContent className="w-full overflow-y-auto sm:max-w-[760px]"><SheetHeader className="border-b p-6 pr-14"><SheetTitle className="text-2xl">{selected.title}</SheetTitle><SheetDescription>{selected.durationMinutes} minutes · {selected.status.replaceAll("_", " ")} · {data.enrollment.timezone}</SheetDescription></SheetHeader><div className="space-y-6 p-6">{data.assets.filter((asset) => asset.lessonId === selected.id && asset.kind === "video").map((asset) => <video key={asset.id} className="aspect-video w-full rounded-2xl bg-[#0d1b44]" controls preload="metadata" src={asset.url}><track kind="captions" />Your browser does not support video playback.</video>)}{!data.assets.some((asset) => asset.lessonId === selected.id && asset.kind === "video") ? <div className="rounded-2xl bg-[#0d1b44] p-8 text-white"><MonitorPlay className="size-8" /><h3 className="mt-6 text-xl font-semibold">Guided learning session</h3><p className="mt-3 leading-7 text-white/70">{selected.description}</p><p className="mt-5 text-sm text-white/55">Plan approximately {selected.durationMinutes} minutes for instruction, practice, and reflection.</p></div> : null}<section><h3 className="font-semibold">Learning objectives</h3><ul className="mt-3 space-y-2">{selected.learningObjectives.map((objective) => <li key={objective} className="flex gap-3 text-sm leading-6 text-muted-foreground"><CheckCircle2 className="mt-1 size-4 shrink-0 text-[var(--success)]" />{objective}</li>)}</ul></section>{data.assets.filter((asset) => asset.lessonId === selected.id && asset.kind !== "video").length ? <section><h3 className="font-semibold">Resources</h3><div className="mt-3 space-y-2">{data.assets.filter((asset) => asset.lessonId === selected.id && asset.kind !== "video").map((asset) => <a key={asset.id} href={asset.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border p-3 text-sm font-semibold hover:bg-muted"><FileText className="size-4 text-primary" />{asset.filename}</a>)}</div></section> : null}<section className="rounded-2xl border bg-card p-5"><h3 className="font-semibold">Assessment</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{selected.assignmentPrompt}</p>{selected.lectureCompletedAt ? <div className="mt-5 space-y-2"><Label htmlFor="assessment-response">Your response</Label><Textarea id="assessment-response" value={responseText} onChange={(event) => setResponseText(event.target.value)} className="min-h-40" placeholder="Present your applied response, evidence, safeguards, and reflection…" /><Button className="mt-3" disabled={selected.status === "submitted" || selected.status === "passed"} onClick={submitAssessment}>{selected.status === "submitted" ? "Awaiting review" : selected.status === "passed" ? "Passed" : "Submit assessment"}</Button></div> : <Button className="mt-5" onClick={() => updateProgress(selected, "complete_lecture")}>Mark lecture complete</Button>}</section></div></SheetContent> : null}</Sheet>
    </>
  );
}

type SubmissionRecord = {
  id: string;
  lessonTitle: string;
  attempt: number;
  responseText: string | null;
  score: number | null;
  status: string;
  submittedAt: string | null;
  feedback: string | null;
};

function SubmissionsView() {
  const [rows, setRows] = useState<SubmissionRecord[]>([]);
  const [certificate, setCertificate] = useState<{ verificationCode: string; issuedAt: string; programTitle: string } | null>(null);
  const [selected, setSelected] = useState<SubmissionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/submissions?pageSize=100", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load submissions.");
        setRows(result.data ?? []);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not load submissions."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    fetch("/api/certificates", { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => setCertificate(result.data?.[0] ?? null))
      .catch(() => undefined);
  }, []);
  const graded = rows.filter((row) => row.score !== null);
  const average = graded.length ? Math.round(graded.reduce((sum, row) => sum + (row.score ?? 0), 0) / graded.length) : 0;
  const passed = rows.filter((row) => row.status === "passed").length;
  return (
    <>
      <PageHeading eyebrow={`${rows.length} assessment attempts`} title="Submissions" description="Your work, reviewer feedback, scores, and resubmission history in one place." action={<Button variant="outline" onClick={() => window.dispatchEvent(new Event("vela:support"))}><FileText /> Assessment help</Button>} />
      {certificate ? <section className="mb-5 flex flex-col justify-between gap-4 rounded-[20px] border border-primary/25 bg-accent p-6 sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-primary">Verified certification</p><h2 className="mt-2 text-xl font-bold">{certificate.programTitle}</h2><p className="mt-1 text-sm text-muted-foreground">Issued {new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(certificate.issuedAt))} · Code {certificate.verificationCode}</p></div><Button variant="outline" asChild><a href={`/api/certificates/${certificate.verificationCode}`} target="_blank" rel="noreferrer"><ShieldCheck /> Verify credential</a></Button></section> : null}
      <div className="mb-5 grid gap-4 sm:grid-cols-3">{[["Average score", graded.length ? `${average}%` : "—", `Across ${graded.length} graded assessments`], ["Passed", String(passed), "Lessons released after a passing review"], ["Awaiting review", String(rows.filter((row) => ["submitted", "in_review"].includes(row.status)).length), "Tracked in the reviewer service level"]].map(([label, value, note]) => <div key={label} className="rounded-2xl border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-3 text-2xl font-bold tracking-[-.04em]">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></div>)}</div>
      <div className="overflow-hidden rounded-[20px] border bg-card"><Table><TableHeader><TableRow><TableHead className="pl-5">Assignment</TableHead><TableHead>Submitted</TableHead><TableHead>Attempt</TableHead><TableHead>Score</TableHead><TableHead>Status</TableHead><TableHead className="pr-5 text-right">Feedback</TableHead></TableRow></TableHeader><TableBody>{loading ? <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">Loading assessment history…</TableCell></TableRow> : rows.length ? rows.map((row) => <TableRow key={row.id}><TableCell className="min-w-[260px] py-4 pl-5"><p className="font-semibold">{row.lessonTitle}</p><p className="mt-1 text-xs text-muted-foreground">{row.responseText?.slice(0, 90) ?? "Structured response"}{row.responseText && row.responseText.length > 90 ? "…" : ""}</p></TableCell><TableCell className="text-muted-foreground">{row.submittedAt ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(row.submittedAt)) : "Draft"}</TableCell><TableCell>{row.attempt} of 3</TableCell><TableCell className="font-semibold">{row.score === null ? "—" : `${row.score}%`}</TableCell><TableCell><StatusPill status={row.status.replaceAll("_", " ")} /></TableCell><TableCell className="pr-5 text-right"><Button variant="ghost" size="sm" disabled={!row.feedback} onClick={() => setSelected(row)}>View review</Button></TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No submissions yet. Your completed lectures will unlock assessments.</TableCell></TableRow>}</TableBody></Table></div>
      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>{selected ? <DialogContent><DialogHeader><DialogTitle>{selected.lessonTitle}</DialogTitle><DialogDescription>Attempt {selected.attempt} · {selected.score}%</DialogDescription></DialogHeader><div className="rounded-xl bg-muted p-5 text-sm leading-7">{selected.feedback}</div><DialogFooter><Button onClick={() => setSelected(null)}>Close</Button></DialogFooter></DialogContent> : null}</Dialog>
    </>
  );
}

function EnrolStudentDialog({ onCreated, onSetup }: { onCreated?: () => void; onSetup?: (destination: "content" | "schedule") => void }) {
  const [open, setOpen] = useState(false);
  const [cohorts, setCohorts] = useState<Array<{ id: string; name: string; startDate: string }>>([]);
  const [programCount, setProgramCount] = useState(0);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", cohortId: "", assignedStartDate: "", timezone: "Africa/Lagos", password: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingOptions(true);
    Promise.all([
      fetch("/api/admin/cohorts", { cache: "no-store" }),
      fetch("/api/admin/curriculum", { cache: "no-store" }),
    ])
      .then(async ([cohortResponse, curriculumResponse]) => {
        const [cohortResult, curriculumResult] = await Promise.all([cohortResponse.json(), curriculumResponse.json()]);
        if (!cohortResponse.ok) throw new Error(cohortResult.error ?? "Could not load cohorts.");
        if (!curriculumResponse.ok) throw new Error(curriculumResult.error ?? "Could not load programmes.");
        const options = cohortResult.data ?? [];
        setCohorts(options);
        setProgramCount(curriculumResult.programs?.length ?? 0);
        if (options[0]) setForm((current) => ({ ...current, cohortId: current.cohortId || options[0].id, assignedStartDate: current.assignedStartDate || options[0].startDate }));
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not load enrolment options."))
      .finally(() => setLoadingOptions(false));
  }, [open]);

  async function createStudent() {
    if (!form.fullName || !form.email || !form.cohortId || !form.assignedStartDate) {
      toast.error("Complete all required enrolment fields.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/admin/students", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, password: form.password || undefined, role: "student", sendWelcomeEmail: true }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Enrolment failed.");
      if (result.emailDelivery?.sent) {
        toast.success("Learner enrolled and the secure welcome email was sent.");
      } else {
        toast.warning(result.temporaryPassword ? `Learner enrolled, but email delivery is pending. Temporary password: ${result.temporaryPassword}` : "Learner enrolled, but email delivery is pending.");
      }
      setOpen(false);
      setForm({ fullName: "", email: "", cohortId: "", assignedStartDate: "", timezone: "Africa/Lagos", password: "" });
      onCreated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enrolment failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><UserPlus /> Enrol student</Button></DialogTrigger>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader><DialogTitle>Enrol a new student</DialogTitle><DialogDescription>Create a tenant-scoped profile, schedule, and secure temporary credential.</DialogDescription></DialogHeader>
        <div className="grid gap-5 py-3 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="enrol-name">Full name</Label><Input id="enrol-name" placeholder="e.g. Ada Nwosu" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="enrol-email">Work email</Label><Input id="enrol-email" type="email" placeholder="ada@company.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
          <div className="space-y-2"><Label>Cohort <span className="text-destructive">*</span></Label><Select disabled={loadingOptions || !cohorts.length} value={form.cohortId} onValueChange={(value) => { const cohort = cohorts.find((item) => item.id === value); setForm({ ...form, cohortId: value, assignedStartDate: cohort?.startDate ?? form.assignedStartDate }); }}><SelectTrigger className="w-full"><SelectValue placeholder={loadingOptions ? "Loading cohorts…" : cohorts.length ? "Select cohort" : "No cohort available"} /></SelectTrigger><SelectContent>{cohorts.map((cohort) => <SelectItem value={cohort.id} key={cohort.id}>{cohort.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="enrol-date">Programme start date</Label><Input id="enrol-date" type="date" value={form.assignedStartDate} onChange={(event) => setForm({ ...form, assignedStartDate: event.target.value })} /></div>
          <div className="space-y-2"><Label>Timezone</Label><Select value={form.timezone} onValueChange={(value) => setForm({ ...form, timezone: value })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Africa/Lagos">Africa/Lagos</SelectItem><SelectItem value="Europe/London">Europe/London</SelectItem><SelectItem value="America/New_York">America/New_York</SelectItem><SelectItem value="Asia/Kolkata">Asia/Kolkata</SelectItem><SelectItem value="Asia/Singapore">Asia/Singapore</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="enrol-password">Temporary password <span className="text-muted-foreground">(optional)</span></Label><Input id="enrol-password" type="password" placeholder="Generate securely" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></div>
        </div>
        {!loadingOptions && !cohorts.length ? <div className="rounded-xl border border-[#e3bf72] bg-[#fff8e8] p-4 text-sm text-[#5f4818] dark:border-[#6e5728] dark:bg-[#2c2414] dark:text-[#f5dfaa]"><div className="flex items-start gap-3"><CircleAlert className="mt-0.5 size-5 shrink-0" /><div><p className="font-semibold">{programCount ? "Create a cohort before enrolling" : "Create a programme before enrolling"}</p><p className="mt-1 text-xs leading-5 opacity-80">{programCount ? "A cohort supplies the programme, operating dates, capacity, and release policy required for this enrolment." : "This is a fresh workspace. Add the real programme first, then create its first cohort."}</p><Button type="button" size="sm" variant="outline" className="mt-3 bg-background" onClick={() => { setOpen(false); onSetup?.(programCount ? "schedule" : "content"); }}>{programCount ? "Create cohort" : "Set up programme"}</Button></div></div></div> : null}
        <div className="rounded-xl bg-muted p-4 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mb-2 size-4 text-primary" />The learner must replace the temporary password. Release times use their IANA timezone and assigned start date.</div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={saving || loadingOptions || !cohorts.length} onClick={createStudent}>{saving ? "Creating…" : "Create profile & send email"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UploadLectureDialog() {
  const [open, setOpen] = useState(false);
  const [phaseOptions, setPhaseOptions] = useState<Array<{ id: string; title: string; position: number }>>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [objectives, setObjectives] = useState("");
  const [assignmentPrompt, setAssignmentPrompt] = useState("");
  const [phaseId, setPhaseId] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(95);
  const [releaseOffset, setReleaseOffset] = useState(0);
  const [passMark, setPassMark] = useState(70);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    fetch("/api/admin/curriculum", { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => {
        setPhaseOptions(result.phases ?? []);
        if (result.phases?.[0]) setPhaseId((current) => current || result.phases[0].id);
        const offsets = (result.lessons ?? []).map((lesson: { releaseOffset: number }) => lesson.releaseOffset);
        setReleaseOffset(offsets.length ? Math.max(...offsets) + 1 : 0);
      })
      .catch(() => toast.error("Could not load curriculum phases."));
  }, [open]);

  async function createLecture(publish: boolean) {
    if (!title || !description || !assignmentPrompt || !phaseId || objectives.trim().length < 3) return toast.error("Complete the lecture, objectives, and assessment fields.");
    setSaving(true);
    try {
      const response = await fetch("/api/admin/curriculum", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "lesson",
          phaseId,
          title,
          description,
          learningObjectives: objectives.split("\n").map((item) => item.trim()).filter(Boolean),
          assignmentPrompt,
          durationMinutes,
          position: releaseOffset + 1,
          releaseOffset,
          passMark,
          maximumAttempts: 3,
          publish,
          assessment: {
            title: `${title} assessment`,
            instructions: assignmentPrompt,
            submissionType: "mixed",
            rubric: [
              { criterion: "Application", points: 40, description: "Applies the lesson method to a realistic enterprise context." },
              { criterion: "Accuracy", points: 35, description: "Uses accurate concepts and evidence." },
              { criterion: "Responsible practice", points: 25, description: "Addresses safety, inclusion, privacy, and transfer." },
            ],
          },
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Lecture could not be created.");
      if (file) {
        const kind = file.type.startsWith("video/") ? "video" : file.type === "application/pdf" ? "slides" : "document";
        await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/uploads",
          clientPayload: JSON.stringify({
            lessonId: result.data.id,
            kind,
            filename: file.name,
            contentType: file.type,
            sizeBytes: file.size,
            accessibilityLabel: `${title} ${kind}`,
          }),
        });
      }
      toast.success(publish ? "Lecture published to the governed curriculum." : "Lecture saved as a draft.");
      window.dispatchEvent(new Event("vela:curriculum-updated"));
      setOpen(false);
      setTitle("");
      setDescription("");
      setObjectives("");
      setAssignmentPrompt("");
      setFile(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lecture could not be created.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><CloudUpload /> Upload lecture</Button></DialogTrigger>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader><DialogTitle>Add a lecture session</DialogTitle><DialogDescription>Upload learning assets, define the assessment, and set the release rule.</DialogDescription></DialogHeader>
        <div className="max-h-[68vh] space-y-5 overflow-y-auto py-3 pr-1"><div className="space-y-2"><Label htmlFor="lecture-title">Lecture title</Label><Input id="lecture-title" placeholder="e.g. Facilitating AI adoption conversations" value={title} onChange={(event) => setTitle(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="lecture-description">Description</Label><Textarea id="lecture-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explain the learning experience and enterprise context…" /></div><div className="space-y-2"><Label htmlFor="lecture-objectives">Learning objectives <span className="text-muted-foreground">(one per line)</span></Label><Textarea id="lecture-objectives" value={objectives} onChange={(event) => setObjectives(event.target.value)} placeholder={"Explain the core method\nApply it to a workplace scenario\nEvaluate the result responsibly"} /></div><div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label>Phase</Label><Select value={phaseId} onValueChange={setPhaseId}><SelectTrigger className="w-full"><SelectValue placeholder="Select phase" /></SelectTrigger><SelectContent>{phaseOptions.map((phase) => <SelectItem value={phase.id} key={phase.id}>{phase.position}. {phase.title}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Estimated duration</Label><Select value={String(durationMinutes)} onValueChange={(value) => setDurationMinutes(Number(value))}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="60">1 hour</SelectItem><SelectItem value="95">1 hr 35 min</SelectItem><SelectItem value="120">2 hours</SelectItem></SelectContent></Select></div></div><label className="grid min-h-28 cursor-pointer place-items-center rounded-xl border border-dashed border-input bg-muted/45 p-5 text-center"><input type="file" className="sr-only" accept=".mp4,.webm,.pdf,.pptx,.docx,.vtt,.txt" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><span><Upload className="mx-auto mb-3 size-5 text-primary" /><span className="block text-sm font-semibold">{file ? file.name : "Choose video, slides, or resources"}</span><span className="mt-1 block text-xs text-muted-foreground">MP4, WebM, PDF, PPTX, DOCX, VTT · up to 25 MB by default</span></span></label><div className="space-y-2"><Label htmlFor="lecture-assignment">Assignment prompt</Label><Textarea id="lecture-assignment" value={assignmentPrompt} onChange={(event) => setAssignmentPrompt(event.target.value)} placeholder="Describe the practical work students must submit…" /></div><div className="grid gap-5 sm:grid-cols-3"><div className="space-y-2"><Label htmlFor="lecture-pass">Pass mark</Label><Input id="lecture-pass" type="number" min={1} max={100} value={passMark} onChange={(event) => setPassMark(Number(event.target.value))} /></div><div className="space-y-2"><Label htmlFor="lecture-offset">Release sequence</Label><Input id="lecture-offset" type="number" min={0} value={releaseOffset} onChange={(event) => setReleaseOffset(Number(event.target.value))} /></div><div className="space-y-2"><Label>Release rule</Label><Input value="Schedule + previous pass" readOnly /></div></div></div>
        <DialogFooter><Button variant="outline" disabled={saving} onClick={() => createLecture(false)}>Save draft</Button><Button disabled={saving} onClick={() => createLecture(true)}>{saving ? "Saving…" : "Publish lecture"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdminCommand({ onStudents, onReviews, onSetup }: { onStudents: () => void; onReviews: () => void; onSetup: (destination: "content" | "schedule") => void }) {
  const [metrics, setMetrics] = useState<ReportMetrics | null>(null);
  const [liveQueue, setLiveQueue] = useState<ReviewItem[]>([]);
  useEffect(() => {
    Promise.all([
      fetch("/api/admin/reports", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/admin/reviews?status=submitted&pageSize=4", { cache: "no-store" }).then((response) => response.json()),
    ]).then(([report, reviews]) => {
      setMetrics(report.metrics ?? null);
      setLiveQueue(reviews.data ?? []);
    }).catch(() => toast.error("Could not refresh command-centre metrics."));
  }, []);
  const commandStats = metrics ? [
    { label: "Active learners", value: String(metrics.activeLearners), note: `${metrics.learners} total enrolments` },
    { label: "Completion rate", value: `${metrics.completionRate}%`, note: `${metrics.certificatesIssued} certificates issued` },
    { label: "Awaiting review", value: String(metrics.pendingReviews), note: "Oldest submissions first" },
    { label: "Overdue lessons", value: String(metrics.overdueLessons), note: "Candidates for outreach" },
  ] : [
    { label: "Active learners", value: "—", note: "Loading live enrolments" },
    { label: "Completion rate", value: "—", note: "Loading verified outcomes" },
    { label: "Awaiting review", value: "—", note: "Loading submission queue" },
    { label: "Overdue lessons", value: "—", note: "Loading learner schedules" },
  ];
  return (
    <>
      <PageHeading eyebrow="Operations overview" title="Programme command centre" description="A concise operating view of learner momentum, assessment quality, and intervention priorities." action={<EnrolStudentDialog onSetup={onSetup} />} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{commandStats.map((stat, index) => <article key={stat.label} className="rounded-[18px] border bg-card p-5"><div className="flex justify-between"><p className="text-sm text-muted-foreground">{stat.label}</p>{index === 2 ? <Clock3 className="size-4 text-[#c47d12]" /> : index === 3 ? <CircleAlert className="size-4 text-[#c05252]" /> : <Activity className="size-4 text-primary" />}</div><p className="mt-4 text-3xl font-[730] tracking-[-.05em]">{stat.value}</p><p className="mt-2 text-xs text-muted-foreground">{stat.note}</p></article>)}</div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,.8fr)]">
        <section className="rounded-[20px] border bg-card p-6">
          <div><h2 className="font-semibold">Live outcome indicators</h2><p className="mt-1 text-sm text-muted-foreground">Calculated from current enrolments, assessments, and certificates</p></div>
          <div className="mt-8 space-y-6">{[["Average learner progress", metrics?.averageProgress ?? 0], ["Programme completion", metrics?.completionRate ?? 0], ["Assessment quality", metrics?.averageScore ?? 0], ["Review queue health", metrics ? Math.max(0, 100 - metrics.pendingReviews * 5) : 0]].map(([label, value]) => <div key={String(label)}><div className="mb-2 flex justify-between text-sm"><span>{label}</span><span className="font-semibold">{value}%</span></div><Progress value={Number(value)} className="h-2" /></div>)}</div>
          {!metrics?.learners ? <p className="mt-8 rounded-xl bg-muted p-4 text-sm text-muted-foreground">No learner activity yet. Metrics will populate as real enrolments begin.</p> : null}
        </section>
        <section className="rounded-[20px] border bg-card p-6"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Attention required</h2><p className="mt-1 text-sm text-muted-foreground">Live operational interventions</p></div><Button variant="ghost" size="sm" onClick={onStudents}>View learners</Button></div><div className="mt-5 space-y-3">{[["Overdue lessons", metrics?.overdueLessons ?? 0, "Review learner pacing and outreach"], ["Pending reviews", metrics?.pendingReviews ?? 0, "Allocate submissions to reviewers"], ["Average progress", `${metrics?.averageProgress ?? 0}%`, "Monitor cohort momentum"], ["Certificates issued", metrics?.certificatesIssued ?? 0, "Verify completed programme outcomes"]].map(([label, value, note], index) => <button key={String(label)} className="flex w-full items-center gap-3 rounded-xl border p-3 text-left hover:bg-muted" onClick={index === 1 ? onReviews : onStudents}><div className={`grid size-9 place-items-center rounded-full text-xs font-bold ${index < 2 ? "bg-[#fff0dd] text-[#a15a00]" : "bg-muted text-muted-foreground"}`}>{value}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{label}</p><p className="truncate text-xs text-muted-foreground">{note}</p></div><ChevronRight className="size-4 text-muted-foreground" /></button>)}</div></section>
      </div>
      <section className="mt-5 overflow-hidden rounded-[20px] border bg-card"><div className="flex items-center justify-between p-6"><div><h2 className="font-semibold">Review queue</h2><p className="mt-1 text-sm text-muted-foreground">Oldest tenant-scoped submissions first · {metrics?.pendingReviews ?? liveQueue.length} total</p></div><Button variant="outline" size="sm" onClick={onReviews}>Open review workspace</Button></div><Table><TableHeader><TableRow><TableHead className="pl-6">Student</TableHead><TableHead>Assignment</TableHead><TableHead>Submitted</TableHead><TableHead>Attempt</TableHead><TableHead className="pr-6 text-right">Action</TableHead></TableRow></TableHeader><TableBody>{liveQueue.length ? liveQueue.map((review) => <TableRow key={review.id}><TableCell className="py-4 pl-6"><div className="flex items-center gap-3"><div className="grid size-8 place-items-center rounded-full bg-muted text-xs font-bold">{initials(review.studentName)}</div><span className="font-semibold">{review.studentName}</span></div></TableCell><TableCell>{review.lessonTitle}</TableCell><TableCell className="text-muted-foreground">{review.submittedAt ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(review.submittedAt)) : "—"}</TableCell><TableCell>{review.attempt} of 3</TableCell><TableCell className="pr-6 text-right"><Button variant="ghost" size="sm" onClick={onReviews}>Review</Button></TableCell></TableRow>) : <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No submissions are waiting for review.</TableCell></TableRow>}</TableBody></Table></section>
    </>
  );
}

type AdminStudent = {
  id: string;
  email: string;
  fullName: string;
  timezone: string | null;
  status: string;
  enrollmentStatus: string | null;
  progressPercent: number | null;
  assignedStartDate: string | null;
  cohortName: string | null;
};

function StudentsView({ onSetup }: { onSetup: (destination: "content" | "schedule") => void }) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<AdminStudent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/students?page=${page}&pageSize=20&q=${encodeURIComponent(query)}`, { signal: controller.signal, cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load learners.");
        setRows(result.data ?? []);
        setTotal(result.pagination?.total ?? 0);
      } catch (error) {
        if ((error as Error).name !== "AbortError") toast.error(error instanceof Error ? error.message : "Could not load learners.");
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query, page, reload]);

  async function studentAction(student: AdminStudent, action: "reset_password" | "suspend") {
    const response = await fetch(`/api/admin/students/${student.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(action === "suspend" ? { userStatus: "suspended" } : { action: "reset_password" }),
    });
    const result = await response.json();
    if (!response.ok) return toast.error(result.error ?? "Action failed.");
    if (result.temporaryPassword && result.emailSent) toast.success("A secure temporary password was emailed to the learner.");
    else if (result.temporaryPassword) toast.warning(`Email delivery is pending. Temporary password: ${result.temporaryPassword}`);
    else toast.success("Learner access updated.");
    setReload((value) => value + 1);
  }

  return (
    <>
      <PageHeading eyebrow={`${total} learner records`} title="Students" description="Manage enrolment, programme dates, access, progress, and learner interventions." action={<EnrolStudentDialog onCreated={() => setReload((value) => value + 1)} onSetup={onSetup} />} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row"><div className="relative max-w-lg flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search by name or email" className="pl-9" /></div><Button variant="outline"><ListFilter /> Filters</Button><Button asChild variant="outline"><a href="/api/admin/reports/export">Export CSV</a></Button></div>
      <div className="overflow-hidden rounded-[20px] border bg-card"><Table><TableHeader><TableRow><TableHead className="pl-6">Student</TableHead><TableHead>Cohort</TableHead><TableHead>Start date</TableHead><TableHead>Progress</TableHead><TableHead>Access</TableHead><TableHead className="pr-6 text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{loading ? <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">Loading learner records…</TableCell></TableRow> : rows.length ? rows.map((student) => <TableRow key={student.id}><TableCell className="min-w-[260px] py-4 pl-6"><div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-full bg-muted text-xs font-bold">{initials(student.fullName)}</div><div><p className="font-semibold">{student.fullName}</p><p className="text-xs text-muted-foreground">{student.email}</p></div></div></TableCell><TableCell>{student.cohortName ?? "—"}</TableCell><TableCell><p>{student.assignedStartDate ?? "—"}</p><p className="text-xs text-muted-foreground">{student.timezone ?? "Not set"}</p></TableCell><TableCell className="min-w-[140px]"><div className="flex items-center gap-2"><Progress value={student.progressPercent ?? 0} className="h-1.5 w-20" /><span className="text-xs">{student.progressPercent ?? 0}%</span></div></TableCell><TableCell><StatusPill status={student.status === "active" ? (student.enrollmentStatus === "paused" ? "Paused" : "Active") : "Suspended"} /></TableCell><TableCell className="pr-6 text-right"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => toast.info(`${student.fullName} · ${student.email}`)}>View profile</DropdownMenuItem><DropdownMenuItem onClick={() => studentAction(student, "reset_password")}>Reset password</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onClick={() => studentAction(student, "suspend")}>Suspend access</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No learners match this search.</TableCell></TableRow>}</TableBody></Table></div>
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground"><p>Showing {rows.length} of {total} learners · Every access change is audited.</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>
    </>
  );
}

type AdminProgram = { id: string; title: string; description: string; durationWeeks: number; status: string; defaultPassMark: number };
type AdminPhase = { id: string; programId: string; title: string; description: string; outcome: string; position: number };
type AdminLesson = { id: string; phaseId: string; title: string; position: number; status: string; durationMinutes: number };

function CreateProgramDialog() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", slug: "", description: "", durationWeeks: 14, defaultPassMark: 70 });
  async function create() {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/curriculum", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "program", ...form, slug: form.slug || form.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), classDays: [2, 5, 0], publish: true }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Program could not be created.");
      toast.success("Program created and published.");
      setOpen(false);
      setForm({ title: "", slug: "", description: "", durationWeeks: 14, defaultPassMark: 70 });
      window.dispatchEvent(new Event("vela:curriculum-updated"));
    } catch (error) { toast.error(error instanceof Error ? error.message : "Program could not be created."); } finally { setSaving(false); }
  }
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline"><Plus /> New program</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Create enterprise program</DialogTitle><DialogDescription>Start with a clean governed program. Phases, lectures, cohorts, and learners are added next.</DialogDescription></DialogHeader><div className="space-y-4 py-2"><div className="space-y-2"><Label htmlFor="program-title">Program title</Label><Input id="program-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></div><div className="space-y-2"><Label htmlFor="program-description">Description</Label><Textarea id="program-description" className="min-h-28" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label htmlFor="program-weeks">Duration (weeks)</Label><Input id="program-weeks" type="number" min={4} max={52} value={form.durationWeeks} onChange={(event) => setForm({ ...form, durationWeeks: Number(event.target.value) })} /></div><div className="space-y-2"><Label htmlFor="program-pass">Default pass mark</Label><Input id="program-pass" type="number" min={1} max={100} value={form.defaultPassMark} onChange={(event) => setForm({ ...form, defaultPassMark: Number(event.target.value) })} /></div></div></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={saving || form.title.length < 3 || form.description.length < 20} onClick={create}>{saving ? "Creating…" : "Create program"}</Button></DialogFooter></DialogContent></Dialog>;
}

function CreatePhaseDialog({ programs, phases }: { programs: AdminProgram[]; phases: AdminPhase[] }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [programId, setProgramId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [outcome, setOutcome] = useState("");
  useEffect(() => { if (programs[0] && !programId) setProgramId(programs[0].id); }, [programs, programId]);
  async function create() {
    const position = phases.filter((phase) => phase.programId === programId).length + 1;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/curriculum", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "phase", programId, title, description, outcome, position }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Phase could not be created.");
      toast.success("Program phase created."); setOpen(false); setTitle(""); setDescription(""); setOutcome(""); window.dispatchEvent(new Event("vela:curriculum-updated"));
    } catch (error) { toast.error(error instanceof Error ? error.message : "Phase could not be created."); } finally { setSaving(false); }
  }
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline" disabled={!programs.length}><Plus /> Add phase</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Add program phase</DialogTitle><DialogDescription>Define a coherent stage and measurable learner outcome.</DialogDescription></DialogHeader><div className="space-y-4 py-2"><div className="space-y-2"><Label>Program</Label><Select value={programId} onValueChange={setProgramId}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{programs.map((program) => <SelectItem key={program.id} value={program.id}>{program.title}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="phase-title">Phase title</Label><Input id="phase-title" value={title} onChange={(event) => setTitle(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="phase-description">Description</Label><Textarea id="phase-description" value={description} onChange={(event) => setDescription(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="phase-outcome">Outcome</Label><Textarea id="phase-outcome" value={outcome} onChange={(event) => setOutcome(event.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={saving || !programId || title.length < 3 || description.length < 10 || outcome.length < 10} onClick={create}>{saving ? "Creating…" : "Create phase"}</Button></DialogFooter></DialogContent></Dialog>;
}

function ContentView() {
  const [programs, setPrograms] = useState<AdminProgram[]>([]);
  const [phases, setPhases] = useState<AdminPhase[]>([]);
  const [lessons, setLessons] = useState<AdminLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try { const response = await fetch("/api/admin/curriculum", { cache: "no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Could not load curriculum."); setPrograms(result.programs ?? []); setPhases(result.phases ?? []); setLessons(result.lessons ?? []); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not load curriculum."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); const refresh = () => void load(); window.addEventListener("vela:curriculum-updated", refresh); return () => window.removeEventListener("vela:curriculum-updated", refresh); }, []);
  return <>
    <PageHeading eyebrow={`${programs.length} programs · ${phases.length} phases · ${lessons.length} sessions`} title="Curriculum management" description="Build the real learning journey from a clean tenant workspace: programs, phases, lectures, resources, assessments, release rules, and pass marks." action={<div className="flex flex-wrap gap-2"><CreateProgramDialog /><CreatePhaseDialog programs={programs} phases={phases} /><UploadLectureDialog /></div>} />
    {loading ? <div className="grid min-h-[35vh] place-items-center text-sm text-muted-foreground">Loading live curriculum…</div> : programs.length ? <div className="space-y-6">{programs.map((program) => { const programPhases = phases.filter((phase) => phase.programId === program.id); const programLessons = lessons.filter((lesson) => programPhases.some((phase) => phase.id === lesson.phaseId)); return <section key={program.id} className="rounded-[20px] border bg-card p-6"><div className="flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-start"><div><div className="flex items-center gap-2"><Badge className="capitalize" variant={program.status === "published" ? "default" : "outline"}>{program.status}</Badge><span className="text-xs text-muted-foreground">{program.durationWeeks} weeks · {program.defaultPassMark}% pass mark</span></div><h2 className="mt-3 text-2xl font-bold tracking-[-.035em]">{program.title}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{program.description}</p></div><div className="text-sm text-muted-foreground">{programPhases.length} phases · {programLessons.length} sessions</div></div><div className="mt-5 grid gap-4 lg:grid-cols-2">{programPhases.length ? programPhases.map((phase) => { const phaseLessons = lessons.filter((lesson) => lesson.phaseId === phase.id); return <article key={phase.id} className="overflow-hidden rounded-xl border"><div className="p-4"><p className="text-xs font-bold uppercase tracking-wider text-primary">Phase {phase.position}</p><h3 className="mt-1 font-semibold">{phase.title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{phase.description}</p></div><div className="divide-y border-t">{phaseLessons.length ? phaseLessons.map((lesson) => <div key={lesson.id} className="flex items-center gap-3 px-4 py-3"><span className="w-6 text-xs font-bold text-muted-foreground">{String(lesson.position).padStart(2, "0")}</span><span className="min-w-0 flex-1 truncate text-sm font-medium">{lesson.title}</span><Badge variant="outline" className="capitalize">{lesson.status}</Badge></div>) : <p className="px-4 py-6 text-center text-sm text-muted-foreground">No lectures in this phase yet.</p>}</div></article>; }) : <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground lg:col-span-2">Add the first phase to begin structuring this program.</div>}</div></section>; })}</div> : <section className="rounded-[22px] border border-dashed bg-card p-12 text-center"><Library className="mx-auto size-8 text-muted-foreground" /><h2 className="mt-5 text-xl font-semibold">Start with your first program</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">This enterprise workspace is intentionally empty. Create a program, add phases and lectures, then create a cohort before enrolling students.</p><div className="mt-6 flex justify-center"><CreateProgramDialog /></div></section>}
  </>;
}

type ReviewItem = {
  id: string;
  studentName: string;
  studentEmail: string;
  lessonTitle: string;
  attempt: number;
  responseText: string | null;
  submittedAt: string | null;
  passMark: number;
};

function ReviewWorkspace() {
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [selected, setSelected] = useState<ReviewItem | null>(null);
  const [feedback, setFeedback] = useState("");
  const [score, setScore] = useState(85);
  const [loading, setLoading] = useState(true);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/reviews?status=submitted&pageSize=100", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not load the review queue.");
      setQueue(result.data ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load the review queue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadQueue(); }, []);

  async function completeReview(decision: "passed" | "changes_requested") {
    if (!selected) return;
    if (feedback.trim().length < 10) return toast.error("Add actionable reviewer feedback.");
    const response = await fetch(`/api/admin/reviews/${selected.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision, score, feedback, rubricScores: {} }),
    });
    const result = await response.json();
    if (!response.ok) return toast.error(result.error ?? "Review could not be saved.");
    toast.success(decision === "passed" ? "Assessment passed. Progression was recalculated." : "Changes requested. The next lesson remains locked.");
    setSelected(null);
    setFeedback("");
    await loadQueue();
  }

  return (
    <>
      <PageHeading eyebrow={`${queue.length} waiting`} title="Assignment reviews" description="Apply the shared rubric, give actionable feedback, and release the learner’s next session." action={<Button variant="outline"><FileText /> Review rubric</Button>} />
      <div className="overflow-hidden rounded-[20px] border bg-card"><Table><TableHeader><TableRow><TableHead className="pl-6">Student</TableHead><TableHead>Assignment</TableHead><TableHead>Submitted</TableHead><TableHead>Attempt</TableHead><TableHead>Pass mark</TableHead><TableHead className="pr-6 text-right">Action</TableHead></TableRow></TableHeader><TableBody>{loading ? <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">Loading submissions…</TableCell></TableRow> : queue.length ? queue.map((review, index) => <TableRow key={review.id}><TableCell className="py-4 pl-6"><div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-full bg-muted text-xs font-bold">{initials(review.studentName)}</div><div><p className="font-semibold">{review.studentName}</p><p className="text-xs text-muted-foreground">{review.studentEmail}</p></div></div></TableCell><TableCell className="min-w-[260px]">{review.lessonTitle}</TableCell><TableCell>{review.submittedAt ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(review.submittedAt)) : "—"}</TableCell><TableCell>{review.attempt} of 3</TableCell><TableCell>{review.passMark}%</TableCell><TableCell className="pr-6 text-right"><Button size="sm" variant={index === 0 ? "default" : "outline"} onClick={() => { setSelected(review); setScore(Math.max(85, review.passMark)); }}>Review</Button></TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">The review queue is clear.</TableCell></TableRow>}</TableBody></Table></div>
      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>{selected ? <SheetContent className="w-full overflow-y-auto sm:max-w-[660px]"><SheetHeader className="border-b p-6 pr-14"><SheetTitle className="text-xl">{selected.lessonTitle}</SheetTitle><SheetDescription>{selected.studentName} · Attempt {selected.attempt} · minimum {selected.passMark}%</SheetDescription></SheetHeader><div className="space-y-6 p-6"><section className="rounded-xl border bg-card p-5"><p className="text-sm font-semibold">Submitted work</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{selected.responseText ?? "Structured answers and uploaded artefacts were submitted."}</p></section><div className="space-y-2"><Label htmlFor="review-feedback">Reviewer feedback</Label><Textarea id="review-feedback" className="min-h-32" value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Give specific, evidence-based, actionable feedback…" /></div><div className="space-y-2"><Label htmlFor="review-score">Final score</Label><Input id="review-score" type="number" min={0} max={100} value={score} onChange={(event) => setScore(Number(event.target.value))} /></div></div><SheetFooter className="sticky bottom-0 flex-row border-t bg-background/95 p-5 backdrop-blur"><Button variant="outline" className="flex-1" onClick={() => completeReview("changes_requested")}>Request changes</Button><Button className="flex-1" onClick={() => completeReview("passed")}>Approve & pass</Button></SheetFooter></SheetContent> : null}</Sheet>
    </>
  );
}

function CalendarEventDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", kind: "live_session", startsAt: "", endsAt: "", meetingUrl: "" });
  const [saving, setSaving] = useState(false);
  async function createEvent() {
    setSaving(true);
    try {
      const response = await fetch("/api/calendar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: new Date(form.endsAt).toISOString(),
          meetingUrl: form.meetingUrl || undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Calendar event could not be created.");
      toast.success("Organisation-wide calendar event published.");
      setOpen(false);
      setForm({ title: "", description: "", kind: "live_session", startsAt: "", endsAt: "", meetingUrl: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Calendar event could not be created.");
    } finally {
      setSaving(false);
    }
  }
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus /> Create event</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Create calendar event</DialogTitle><DialogDescription>Publish office hours, a live session, or a certification panel to every learner calendar.</DialogDescription></DialogHeader><div className="space-y-4 py-2"><div className="space-y-2"><Label htmlFor="event-title">Title</Label><Input id="event-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></div><div className="space-y-2"><Label>Event type</Label><Select value={form.kind} onValueChange={(kind) => setForm({ ...form, kind })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="live_session">Live session</SelectItem><SelectItem value="office_hours">Office hours</SelectItem><SelectItem value="panel">Certification panel</SelectItem></SelectContent></Select></div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label htmlFor="event-start">Starts</Label><Input id="event-start" type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></div><div className="space-y-2"><Label htmlFor="event-end">Ends</Label><Input id="event-end" type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} /></div></div><div className="space-y-2"><Label htmlFor="event-url">Meeting URL</Label><Input id="event-url" type="url" value={form.meetingUrl} onChange={(event) => setForm({ ...form, meetingUrl: event.target.value })} /></div><div className="space-y-2"><Label htmlFor="event-description">Description</Label><Textarea id="event-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={saving || !form.title || !form.startsAt || !form.endsAt} onClick={createEvent}>{saving ? "Publishing…" : "Publish event"}</Button></DialogFooter></DialogContent></Dialog>;
}

type AdminCohort = { id: string; name: string; startDate: string; endDate: string; status: string; capacity: number | null; timezonePolicy: string; cohortTimezone: string | null; programId: string; programTitle: string };

function CreateCohortDialog({ programs, onCreated }: { programs: Array<AdminProgram & { classDays?: number[] }>; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ programId: "", name: "", startDate: "", endDate: "", capacity: 100, timezonePolicy: "learner" });
  useEffect(() => { if (programs[0] && !form.programId) setForm((current) => ({ ...current, programId: programs[0].id })); }, [programs, form.programId]);
  async function create() {
    setSaving(true);
    try { const response = await fetch("/api/admin/cohorts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, capacity: Number(form.capacity), status: "active" }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Cohort could not be created."); toast.success("Cohort created and ready for enrolment."); setOpen(false); setForm({ programId: programs[0]?.id ?? "", name: "", startDate: "", endDate: "", capacity: 100, timezonePolicy: "learner" }); onCreated(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Cohort could not be created."); } finally { setSaving(false); }
  }
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button disabled={!programs.length}><Plus /> New cohort</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Create cohort</DialogTitle><DialogDescription>Assign a published program and live operating dates before enrolling learners.</DialogDescription></DialogHeader><div className="space-y-4 py-2"><div className="space-y-2"><Label>Program</Label><Select value={form.programId} onValueChange={(programId) => setForm({ ...form, programId })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{programs.map((program) => <SelectItem value={program.id} key={program.id}>{program.title}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="cohort-name">Cohort name</Label><Input id="cohort-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. October 2026" /></div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label htmlFor="cohort-start">Start date</Label><Input id="cohort-start" type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></div><div className="space-y-2"><Label htmlFor="cohort-end">End date</Label><Input id="cohort-end" type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></div></div><div className="space-y-2"><Label htmlFor="cohort-capacity">Capacity</Label><Input id="cohort-capacity" type="number" min={1} value={form.capacity} onChange={(event) => setForm({ ...form, capacity: Number(event.target.value) })} /></div></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={saving || !form.programId || form.name.length < 3 || !form.startDate || !form.endDate} onClick={create}>{saving ? "Creating…" : "Create cohort"}</Button></DialogFooter></DialogContent></Dialog>;
}

function ScheduleAdmin() {
  const [cohorts, setCohorts] = useState<AdminCohort[]>([]);
  const [programs, setPrograms] = useState<Array<AdminProgram & { classDays: number[] }>>([]);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try { const [cohortResponse, curriculumResponse] = await Promise.all([fetch("/api/admin/cohorts", { cache: "no-store" }), fetch("/api/admin/curriculum", { cache: "no-store" })]); const [cohortResult, curriculumResult] = await Promise.all([cohortResponse.json(), curriculumResponse.json()]); if (!cohortResponse.ok) throw new Error(cohortResult.error ?? "Could not load cohorts."); if (!curriculumResponse.ok) throw new Error(curriculumResult.error ?? "Could not load programs."); setCohorts(cohortResult.data ?? []); setPrograms(curriculumResult.programs ?? []); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not load schedule data."); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const days = programs[0]?.classDays ?? [];
  const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  return <>
    <PageHeading eyebrow={`${cohorts.length} cohorts · live operating dates`} title="Release schedule" description="Govern live cohort dates, release cadence, deadlines, and progression rules across learner timezones." action={<div className="flex gap-2"><CalendarEventDialog /><CreateCohortDialog programs={programs} onCreated={() => void load()} /></div>} />
    {loading ? <div className="grid min-h-[35vh] place-items-center text-sm text-muted-foreground">Loading release configuration…</div> : <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="rounded-[20px] border bg-card p-6"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Weekly cadence</h2><p className="mt-1 text-sm text-muted-foreground">Read from the current program configuration and applied from each learner’s assigned start date.</p></div>{programs.length ? <StatusPill status="Active policy" /> : <Badge variant="outline">Not configured</Badge>}</div>{days.length ? <div className="mt-6 grid gap-3 sm:grid-cols-3">{days.map((day, index) => <div key={day} className="rounded-xl border bg-muted/35 p-5"><span className="grid size-9 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">{dayNames[day]}</span><p className="mt-5 text-sm font-semibold">Learning day {String(index + 1).padStart(2, "0")}</p><p className="mt-1 text-xs text-muted-foreground">Opens 00:00 · learner local time</p></div>)}</div> : <div className="mt-6 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">Create a program to define its release cadence.</div>}<div className="mt-6 space-y-3">{[["Release condition", "Scheduled day + previous assessment passed"], ["Submission deadline", "23:59 before the next scheduled release"], ["Session duration", "Read from each live lecture record"], ["Failed assessment", "Next session remains locked until a passing review"], ["Timezone source", "Learner IANA timezone with admin override"]].map(([label, value]) => <div key={label} className="flex flex-col justify-between gap-2 border-b py-4 last:border-0 sm:flex-row sm:items-center"><span className="text-sm text-muted-foreground">{label}</span><span className="text-sm font-semibold">{value}</span></div>)}</div></section>
      <aside className="space-y-5"><section className="rounded-[20px] border bg-card p-6"><h2 className="font-semibold">Cohorts</h2><div className="mt-5 space-y-4">{cohorts.length ? cohorts.map((cohort) => <div key={cohort.id} className="rounded-xl bg-muted/55 p-4"><div className="flex justify-between gap-4"><p className="text-sm font-semibold">{cohort.name}</p><Badge variant="outline" className="capitalize">{cohort.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{cohort.programTitle}</p><p className="mt-2 text-xs text-muted-foreground">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(`${cohort.startDate}T12:00:00Z`))} – {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(`${cohort.endDate}T12:00:00Z`))}</p></div>) : <p className="py-8 text-center text-sm text-muted-foreground">No cohorts created yet.</p>}</div></section><section className="rounded-[20px] border border-[#d7b367] bg-[#fff8e8] p-6 text-[#4f3c12] dark:border-[#6e5728] dark:bg-[#2c2414] dark:text-[#f5dfaa]"><div className="flex gap-3"><CircleAlert className="mt-0.5 size-5 shrink-0" /><div><p className="text-sm font-semibold">Daylight-saving safeguard</p><p className="mt-2 text-xs leading-5 opacity-75">Unlocks are recalculated from each learner’s IANA timezone, preventing regional clock drift.</p></div></div></section></aside>
    </div>}
  </>;
}

type ReportMetrics = {
  learners: number;
  activeLearners: number;
  completions: number;
  completionRate: number;
  averageProgress: number;
  pendingReviews: number;
  averageScore: number;
  overdueLessons: number;
  certificatesIssued: number;
};

function ReportsView() {
  const [metrics, setMetrics] = useState<ReportMetrics | null>(null);
  useEffect(() => {
    fetch("/api/admin/reports", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load reporting data.");
        setMetrics(result.metrics);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not load reporting data."));
  }, []);

  const cards = metrics ? [
    ["Active learners", String(metrics.activeLearners), `${metrics.learners} total enrolments`],
    ["Completion rate", `${metrics.completionRate}%`, `${metrics.completions} certificates eligible`],
    ["Average progress", `${metrics.averageProgress}%`, `${metrics.overdueLessons} overdue lessons`],
    ["Assessment quality", `${metrics.averageScore}%`, `${metrics.pendingReviews} awaiting review`],
  ] : [["Loading", "—", "Calculating live metrics"]];

  return (
    <>
      <PageHeading eyebrow="Live executive reporting" title="Programme intelligence" description="Track learner outcomes, operational performance, and certification readiness across every tenant-scoped cohort." action={<div className="flex gap-2"><Button variant="outline" asChild><a href="/api/admin/reports/export">Export CSV</a></Button><Button onClick={() => { navigator.clipboard?.writeText(window.location.href); toast.success("Secure report link copied."); }}>Copy report link</Button></div>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value, note]) => <article key={label} className="rounded-[18px] border bg-card p-6"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-4 text-3xl font-bold tracking-[-.05em]">{value}</p><p className="mt-2 text-xs text-muted-foreground">{note}</p></article>)}</div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]"><section className="rounded-[20px] border bg-card p-6"><h2 className="font-semibold">Operational health</h2><p className="mt-1 text-sm text-muted-foreground">Current programme indicators</p><div className="mt-8 space-y-6">{[["Learner progress", metrics?.averageProgress ?? 0], ["Assessment performance", metrics?.averageScore ?? 0], ["Completion rate", metrics?.completionRate ?? 0], ["Review queue health", metrics ? Math.max(0, 100 - metrics.pendingReviews * 3) : 0]].map(([label, value]) => <div key={String(label)}><div className="mb-2 flex justify-between text-sm"><span>{label}</span><span className="font-semibold">{value}%</span></div><Progress value={Number(value)} className="h-2" /></div>)}</div></section><section className="rounded-[20px] border bg-card p-6"><h2 className="font-semibold">Governance signals</h2><p className="mt-1 text-sm text-muted-foreground">Interventions and verified outcomes</p><div className="mt-7 space-y-3">{[["Certificates issued", metrics?.certificatesIssued ?? 0, "Verified public credential records"], ["Reviews waiting", metrics?.pendingReviews ?? 0, "Requires reviewer allocation"], ["Overdue lessons", metrics?.overdueLessons ?? 0, "Learner outreach candidates"], ["Active enrolments", metrics?.activeLearners ?? 0, "Currently governed by release policy"]].map(([label, value, note]) => <div key={String(label)} className="flex items-center justify-between rounded-xl border p-4"><div><p className="text-sm font-semibold">{label}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></div><span className="text-xl font-bold">{value}</span></div>)}</div></section></div>
    </>
  );
}

export function VelaPlatform({ initialUser }: { initialUser: ClientUser | null }) {
  const [currentUser, setCurrentUser] = useState<ClientUser | null>(initialUser);
  const canAdmin = Boolean(currentUser && ["owner", "admin", "reviewer", "trainer"].includes(currentUser.role));
  const [role, setRole] = useState<Role>(initialUser && ["owner", "admin", "reviewer", "trainer"].includes(initialUser.role) ? "admin" : "learner");
  const [learnerView, setLearnerView] = useState<LearnerView>("curriculum");
  const [adminView, setAdminView] = useState<AdminView>("command");
  const [theme, setTheme] = useState<ThemeMode>("auto");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [programId, setProgramId] = useState<string | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => { document.documentElement.dataset.theme = theme === "auto" ? (media.matches ? "dark" : "light") : theme; };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => {
    if (!currentUser) return;
    const params = new URLSearchParams(window.location.search);
    const requestedView = params.get("view");
    const requestedProgram = params.get("program");
    if (requestedProgram) setProgramId(requestedProgram);
    if (["owner", "admin", "reviewer", "trainer"].includes(currentUser.role)) {
      if (["command", "students", "content", "reviews", "schedule", "reports", "support"].includes(requestedView ?? "")) setAdminView(requestedView as AdminView);
    } else if (["overview", "curriculum", "submissions", "calendar", "support"].includes(requestedView ?? "")) {
      setLearnerView(requestedView as LearnerView);
    }
  }, [currentUser]);

  useEffect(() => {
    const modelContext = (document as Document & { modelContext?: { registerTool?: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    const register = async () => {
      await modelContext.registerTool?.({
        name: "navigate_learning_workspace",
        title: "Navigate learning workspace",
        description: "Open a learner or administrator workspace view in Vela Academy.",
        inputSchema: { type: "object", properties: { role: { type: "string", enum: ["learner", "admin"] }, view: { type: "string" } }, required: ["role", "view"], additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: (input: unknown) => {
          const value = input as { role: Role; view: string };
          const learnerViews = ["overview", "curriculum", "submissions", "calendar", "support"];
          const adminViews = ["command", "students", "content", "reviews", "schedule", "reports", "support"];
          if (!value || !["learner", "admin"].includes(value.role)) {
            throw new Error("role must be learner or admin");
          }
          if (value.role === "learner" && !learnerViews.includes(value.view)) {
            throw new Error("Unknown learner workspace view");
          }
          if (value.role === "admin" && !adminViews.includes(value.view)) {
            throw new Error("Unknown administrator workspace view");
          }
          if (value.role === "admin" && !canAdmin) throw new Error("Administrator access is required");
          setRole(value.role);
          if (value.role === "learner") setLearnerView(value.view as LearnerView);
          if (value.role === "admin") setAdminView(value.view as AdminView);
          return { role: value.role, view: value.view };
        },
      }, { signal: lifecycle.signal });
      await modelContext.registerTool?.({
        name: "open_active_learning_session",
        title: "Open active learning session",
        description: "Open the learner's currently available lecture session.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: async () => {
          const response = await fetch("/api/curriculum", { cache: "no-store" });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error ?? "Curriculum is unavailable");
          const lesson = result.lessons?.find((item: LiveLesson) => ["available", "in_progress", "changes_requested"].includes(item.status));
          setRole("learner");
          setLearnerView("curriculum");
          return lesson ?? { message: "No learning session is currently available." };
        },
      }, { signal: lifecycle.signal });
      await modelContext.registerTool?.({
        name: "search_academy",
        title: "Search Vela Academy",
        description: "Search accessible lessons, people, and support tickets in the signed-in organisation.",
        inputSchema: { type: "object", properties: { query: { type: "string", minLength: 2, maxLength: 80 } }, required: ["query"], additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: async (input: unknown) => {
          const { query } = input as { query: string };
          const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { cache: "no-store" });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error ?? "Search failed");
          return result;
        },
      }, { signal: lifecycle.signal });
      await modelContext.registerTool?.({
        name: "get_learning_schedule",
        title: "Get learning schedule",
        description: "Return the learner's timezone-aware curriculum, release windows, deadlines, and progression status.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: async () => {
          const response = await fetch("/api/curriculum", { cache: "no-store" });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error ?? "Schedule is unavailable");
          return result;
        },
      }, { signal: lifecycle.signal });
      await modelContext.registerTool?.({
        name: "create_academy_support_ticket",
        title: "Create academy support ticket",
        description: "Create a tracked support request for the signed-in user.",
        inputSchema: { type: "object", properties: { subject: { type: "string", minLength: 5, maxLength: 240 }, category: { type: "string", enum: ["technical", "curriculum", "assessment", "account", "accessibility", "other"] }, message: { type: "string", minLength: 10, maxLength: 20000 } }, required: ["subject", "category", "message"], additionalProperties: false },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, untrustedContentHint: false },
        execute: async (input: unknown) => {
          const response = await fetch("/api/support", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...(input as object), priority: "normal" }) });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error ?? "Support request failed");
          return result;
        },
      }, { signal: lifecycle.signal });
      if (canAdmin) {
        await modelContext.registerTool?.({
          name: "list_assignment_review_queue",
          title: "List assignment review queue",
          description: "List tenant-scoped learner submissions waiting for an authorised reviewer.",
          inputSchema: { type: "object", properties: { query: { type: "string", maxLength: 80 } }, additionalProperties: false },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          execute: async (input: unknown) => {
            const query = (input as { query?: string })?.query ?? "";
            const response = await fetch(`/api/admin/reviews?status=submitted&pageSize=50&q=${encodeURIComponent(query)}`, { cache: "no-store" });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error ?? "Review queue is unavailable");
            return result;
          },
        }, { signal: lifecycle.signal });
        await modelContext.registerTool?.({
          name: "enrol_academy_student",
          title: "Enrol academy student",
          description: "Create and schedule a learner in an existing cohort. This returns a one-time temporary password when none is supplied.",
          inputSchema: { type: "object", properties: { email: { type: "string", format: "email" }, fullName: { type: "string", minLength: 2, maxLength: 160 }, timezone: { type: "string" }, cohortId: { type: "string", format: "uuid" }, assignedStartDate: { type: "string", format: "date" } }, required: ["email", "fullName", "timezone", "cohortId", "assignedStartDate"], additionalProperties: false },
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, untrustedContentHint: false },
          execute: async (input: unknown) => {
            const response = await fetch("/api/admin/students", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...(input as object), role: "student", sendWelcomeEmail: true }) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error ?? "Enrolment failed");
            return result;
          },
        }, { signal: lifecycle.signal });
      }
    };
    Promise.resolve(register()).catch(() => undefined);
    return () => lifecycle.abort();
  }, [canAdmin]);

  const content = useMemo(() => {
    if (role === "learner") {
      if (learnerView === "overview") return <LearnerOverviewLive learnerName={currentUser?.fullName ?? "Learner"} onCurriculum={() => setLearnerView("curriculum")} />;
      if (learnerView === "curriculum") return <LiveCurriculumView />;
      if (learnerView === "submissions") return <SubmissionsView />;
      if (learnerView === "calendar") return <LearnerCalendarLive />;
      return <SupportCenter isAdmin={false} />;
    }
    if (adminView === "command") return <AdminCommand onStudents={() => setAdminView("students")} onReviews={() => setAdminView("reviews")} onSetup={setAdminView} />;
    if (adminView === "students") return <StudentsView onSetup={setAdminView} />;
    if (adminView === "content") return <ContentView />;
    if (adminView === "reviews") return <ReviewWorkspace />;
    if (adminView === "schedule") return <ScheduleAdmin />;
    if (adminView === "reports") return <ReportsView />;
    return <SupportCenter isAdmin />;
  }, [role, learnerView, adminView, currentUser?.fullName]);

  if (!currentUser) return <LoginScreen onLogin={(user) => { setCurrentUser(user); setRole(["owner", "admin", "reviewer", "trainer"].includes(user.role) ? "admin" : "learner"); }} theme={theme} setTheme={setTheme} />;

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setCurrentUser(null);
    setRole("learner");
  };
  const setAuthorizedRole = (nextRole: Role) => setRole(nextRole === "admin" && !canAdmin ? "learner" : nextRole);
  const navProps = { role, learnerView, adminView, setLearnerView: (view: LearnerView) => { setLearnerView(view); setMobileOpen(false); }, setAdminView: (view: AdminView) => { setAdminView(view); setMobileOpen(false); }, onRole: setAuthorizedRole, onLogout: logout, user: currentUser, canAdmin };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Toaster richColors position="top-center" />
      <AppSidebar {...navProps} />
      <section className="lg:pl-[248px]">
        <AppHeader role={role} theme={theme} setTheme={setTheme} onRole={setAuthorizedRole} onLogout={logout} onProgram={setProgramId} onNavigate={(type) => { if (type === "person") { setRole("admin"); setAdminView("students"); } else if (type === "support") { if (role === "admin") setAdminView("support"); else setLearnerView("support"); } else if (role === "admin") setAdminView("content"); else setLearnerView("curriculum"); }} onSupport={() => { if (role === "admin") setAdminView("support"); else setLearnerView("support"); }} user={currentUser} canAdmin={canAdmin} mobileNavigation={<Sheet open={mobileOpen} onOpenChange={setMobileOpen}><SheetTrigger asChild><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation"><Menu /></Button></SheetTrigger><SheetContent side="left" className="w-[290px] p-4"><SheetHeader className="px-2 pt-2 text-left"><div className="mb-7 flex items-center gap-3"><BrandMark size={36} /><div><SheetTitle>Vela Academy</SheetTitle><SheetDescription>{role === "learner" ? "AI Trainer Program" : "Programme operations"}</SheetDescription></div></div></SheetHeader><Navigation {...navProps} mobile /></SheetContent></Sheet>} />
        <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-10 lg:py-9">{content}</div>
      </section>
      <ProgramDetailsDialog programId={programId} onClose={() => setProgramId(null)} onOpenCurriculum={() => { if (role === "admin") setAdminView("content"); else setLearnerView("curriculum"); }} />
      <SupportDialog />
      <RequiredPasswordChange user={currentUser} onSignedOut={() => { setCurrentUser(null); setRole("learner"); }} />
    </main>
  );
}
