import "server-only";

import { and, asc, eq, lte } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "@/db";
import { emailOutbox } from "@/db/schema";
import { getOptionalEnv } from "@/lib/env";

export async function queueEmail(input: {
  organizationId: string;
  to: string;
  subject: string;
  template: string;
  payload?: Record<string, unknown>;
  availableAt?: Date;
}) {
  const [record] = await db
    .insert(emailOutbox)
    .values({
      ...input,
      payload: input.payload ?? {},
      availableAt: input.availableAt ?? new Date(),
    })
    .returning({ id: emailOutbox.id });
  return record;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function emailMarkup(template: string, payload: Record<string, unknown>) {
  const heading = escapeHtml(payload.heading ?? payload.title ?? "Vela AI Academy");
  const message = escapeHtml(payload.message ?? "");
  const actionUrl = typeof payload.actionUrl === "string" ? payload.actionUrl : null;
  const actionLabel = escapeHtml(payload.actionLabel ?? "Open academy");
  const details = Array.isArray(payload.details)
    ? payload.details.filter((item): item is { label: unknown; value: unknown } => Boolean(item && typeof item === "object" && "label" in item && "value" in item))
    : [];
  const detailMarkup = details.length
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;border:1px solid #e4e8f2;border-radius:10px">${details.map((item) => `<tr><td style="padding:11px 14px;border-bottom:1px solid #eef1f7;font-size:13px;color:#6b7488;width:38%">${escapeHtml(item.label)}</td><td style="padding:11px 14px;border-bottom:1px solid #eef1f7;font-size:14px;font-weight:700;color:#17213a;word-break:break-word">${escapeHtml(item.value)}</td></tr>`).join("")}</table>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f6fb;font-family:Arial,sans-serif;color:#17213a"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:36px 16px"><table width="600" style="max-width:600px;background:white;border-radius:14px;border:1px solid #e4e8f2"><tr><td style="padding:32px"><div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#2448c5;font-weight:700">Vela AI Academy</div><h1 style="font-size:24px;margin:14px 0 10px">${heading}</h1><p style="font-size:16px;line-height:1.6;color:#4c5872">${message}</p>${detailMarkup}${actionUrl ? `<a href="${escapeHtml(actionUrl)}" style="display:inline-block;margin-top:22px;padding:12px 18px;background:#2448c5;color:white;text-decoration:none;border-radius:8px;font-weight:700">${actionLabel}</a>` : ""}<p style="font-size:12px;line-height:1.6;color:#8992a8;margin-top:30px">Need help? Contact <a href="mailto:vela@scaleworkagency.com" style="color:#2448c5">vela@scaleworkagency.com</a>.<br>Reference: ${escapeHtml(template)}</p></td></tr></table></td></tr></table></body></html>`;
}

async function deliverMessages(messages: Array<typeof emailOutbox.$inferSelect>) {
  const env = getOptionalEnv();
  if (!env.RESEND_API_KEY) return { processed: 0, sent: 0, skipped: messages.length, reason: "RESEND_API_KEY is not configured" };
  const resend = new Resend(env.RESEND_API_KEY);
  let sent = 0;

  for (const message of messages) {
    try {
      const result = await resend.emails.send({
        from: env.EMAIL_FROM ?? "Vela AI Academy <vela@scaleworkagency.com>",
        replyTo: env.SUPPORT_EMAIL ?? "vela@scaleworkagency.com",
        to: message.to,
        subject: message.subject,
        html: emailMarkup(message.template, message.payload),
      });
      if (result.error) throw new Error(result.error.message);
      await db.update(emailOutbox).set({
        status: "sent",
        sentAt: new Date(),
        attempts: message.attempts + 1,
        lastError: null,
        payload: message.payload.sensitive === true ? { delivered: true } : message.payload,
      }).where(eq(emailOutbox.id, message.id));
      sent += 1;
    } catch (error) {
      await db.update(emailOutbox).set({
        status: message.attempts >= 4 ? "failed" : "pending",
        attempts: message.attempts + 1,
        lastError: error instanceof Error ? error.message.slice(0, 1000) : "Unknown provider error",
        availableAt: new Date(Date.now() + Math.min(3_600_000, 60_000 * 2 ** message.attempts)),
      }).where(eq(emailOutbox.id, message.id));
    }
  }
  return { processed: messages.length, sent, skipped: 0 };
}

export async function deliverPendingEmails(limit = 25) {
  const pending = await db
    .select()
    .from(emailOutbox)
    .where(and(eq(emailOutbox.status, "pending"), lte(emailOutbox.availableAt, new Date())))
    .orderBy(asc(emailOutbox.availableAt))
    .limit(limit);

  return deliverMessages(pending);
}

export async function deliverQueuedEmail(id: string) {
  const [message] = await db.select().from(emailOutbox).where(and(eq(emailOutbox.id, id), eq(emailOutbox.status, "pending"))).limit(1);
  if (!message) return { processed: 0, sent: 0, skipped: 0 };
  return deliverMessages([message]);
}

export async function queueAndDeliverEmail(input: Parameters<typeof queueEmail>[0]) {
  const message = await queueEmail(input);
  const delivery = await deliverQueuedEmail(message.id);
  return { id: message.id, ...delivery };
}
