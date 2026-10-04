"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock3, MessageSquareText, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

type SupportTicket = {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  subject: string;
  category: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "in_progress" | "waiting" | "resolved" | "closed";
  createdAt: string;
  updatedAt: string;
};

type SupportMessage = {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  body: string;
  createdAt: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function SupportCenter({ isAdmin }: { isAdmin: boolean }) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/support?pageSize=100", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not load support requests.");
      setTickets(result.data ?? []);
      const ticketId = new URLSearchParams(window.location.search).get("ticket");
      if (ticketId) {
        const match = (result.data ?? []).find((item: SupportTicket) => item.id === ticketId);
        if (match) setSelected(match);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load support requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadThread = useCallback(async (id: string) => {
    const response = await fetch(`/api/support/${id}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Could not load the support conversation.");
    setSelected((current) => current ? { ...current, ...result.ticket } : result.ticket);
    setMessages(result.messages ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTickets();
    const refresh = () => void loadTickets();
    window.addEventListener("vela:support-created", refresh);
    return () => window.removeEventListener("vela:support-created", refresh);
  }, [loadTickets]);

  const selectedId = selected?.id;
  useEffect(() => {
    if (!selectedId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadThread(selectedId).catch((error) => toast.error(error instanceof Error ? error.message : "Could not load the conversation."));
  }, [selectedId, loadThread]);

  async function updateTicket(input: { message?: string; status?: SupportTicket["status"] }) {
    if (!selected) return;
    setSending(true);
    try {
      const response = await fetch(`/api/support/${selected.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Support update failed.");
      setReply("");
      await Promise.all([loadThread(selected.id), loadTickets()]);
      toast.success(input.message ? "Reply sent." : "Ticket status updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Support update failed.");
    } finally {
      setSending(false);
    }
  }

  const openCount = tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status)).length;
  const resolvedCount = tickets.filter((ticket) => ticket.status === "resolved").length;

  return (
    <>
      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-sm font-semibold text-primary">Tracked assistance</p>
          <h1 className="text-[clamp(1.9rem,3vw,2.75rem)] font-[730] tracking-[-0.045em]">{isAdmin ? "Support operations" : "Help centre"}</h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-muted-foreground">{isAdmin ? "Receive learner issues, respond in context, and close the loop with a visible support history." : <>Create a request, follow every response, and continue the conversation with your academy team at <a className="font-semibold text-primary" href="mailto:vela@scaleworkagency.com">vela@scaleworkagency.com</a>.</>}</p>
        </div>
        <Button onClick={() => window.dispatchEvent(new Event("vela:support"))}><Plus /> New request</Button>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        {[["Total requests", tickets.length, MessageSquareText], ["Open", openCount, Clock3], ["Resolved", resolvedCount, CheckCircle2]].map(([label, value, Icon]) => {
          const IconComponent = Icon as typeof MessageSquareText;
          return <article key={String(label)} className="rounded-[18px] border bg-card p-5"><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">{String(label)}</p><IconComponent className="size-4 text-primary" /></div><p className="mt-4 text-3xl font-bold tracking-[-.05em]">{String(value)}</p></article>;
        })}
      </div>

      <section className="overflow-hidden rounded-[20px] border bg-card">
        {loading ? <p className="p-10 text-center text-sm text-muted-foreground">Loading support requests…</p> : tickets.length ? <div className="divide-y">{tickets.map((ticket) => (
          <button key={ticket.id} className="grid w-full gap-3 p-5 text-left transition-colors hover:bg-muted/55 sm:grid-cols-[minmax(0,1fr)_140px_150px_auto] sm:items-center" onClick={() => setSelected(ticket)}>
            <span className="min-w-0"><span className="block truncate font-semibold">{ticket.subject}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{isAdmin ? `${ticket.requesterName} · ${ticket.requesterEmail}` : ticket.category}</span></span>
            <Badge variant="outline" className="w-fit capitalize">{ticket.priority}</Badge>
            <span className="text-xs capitalize text-muted-foreground">{ticket.status.replaceAll("_", " ")}</span>
            <span className="text-xs text-muted-foreground">{formatDate(ticket.updatedAt)}</span>
          </button>
        ))}</div> : <div className="p-12 text-center"><MessageSquareText className="mx-auto size-7 text-muted-foreground" /><h2 className="mt-4 font-semibold">No support requests yet</h2><p className="mt-2 text-sm text-muted-foreground">New requests and replies will appear here in real time.</p></div>}
      </section>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => { if (!open) { setSelected(null); setMessages([]); } }}>
        {selected ? <SheetContent className="flex w-full flex-col overflow-hidden sm:max-w-[680px]">
          <SheetHeader className="border-b p-6 pr-14">
            <SheetTitle className="text-xl">{selected.subject}</SheetTitle>
            <SheetDescription>{selected.category} · {selected.priority} priority · opened {formatDate(selected.createdAt)}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            {messages.map((message) => <article key={message.id} className={`max-w-[88%] rounded-2xl p-4 ${message.authorRole === "student" ? "bg-muted" : "ml-auto bg-primary text-primary-foreground"}`}><div className="flex items-center justify-between gap-4 text-xs font-semibold"><span>{message.authorName}</span><span className={message.authorRole === "student" ? "text-muted-foreground" : "text-primary-foreground/70"}>{formatDate(message.createdAt)}</span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.body}</p></article>)}
          </div>
          <div className="space-y-4 border-t bg-background p-5">
            {isAdmin ? <div className="space-y-2"><Label>Ticket status</Label><Select value={selected.status} onValueChange={(status) => void updateTicket({ status: status as SupportTicket["status"] })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="in_progress">In progress</SelectItem><SelectItem value="waiting">Waiting for student</SelectItem><SelectItem value="resolved">Resolved</SelectItem><SelectItem value="closed">Closed</SelectItem></SelectContent></Select></div> : null}
            <div className="space-y-2"><Label htmlFor="support-reply">Reply</Label><Textarea id="support-reply" value={reply} onChange={(event) => setReply(event.target.value)} placeholder={isAdmin ? "Give a clear, actionable response…" : "Add context or reply to the academy team…"} className="min-h-24" /></div>
            <Button className="w-full" disabled={sending || reply.trim().length < 2} onClick={() => void updateTicket({ message: reply })}><Send /> {sending ? "Sending…" : "Send reply"}</Button>
          </div>
        </SheetContent> : null}
      </Sheet>
    </>
  );
}
