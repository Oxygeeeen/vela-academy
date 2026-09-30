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
  return `<!doctype html><html><body style="margin:0;background:#f4f6fb;font-family:Arial,sans-serif;color:#17213a"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:36px 16px"><table width="600" style="max-width:600px;background:white;border-radius:14px;border:1px solid #e4e8f2"><tr><td style="padding:32px"><div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#2448c5;font-weight:700">Vela AI Academy</div><h1 style="font-size:24px;margin:14px 0 10px">${heading}</h1><p style="font-size:16px;line-height:1.6;color:#4c5872">${message}</p>${actionUrl ? `<a href="${escapeHtml(actionUrl)}" style="display:inline-block;margin-top:18px;padding:12px 18px;background:#2448c5;color:white;text-decoration:none;border-radius:8px;font-weight:700">${actionLabel}</a>` : ""}<p style="font-size:12px;color:#8992a8;margin-top:30px">Template: ${escapeHtml(template)}</p></td></tr></table></td></tr></table></body></html>`;
}

export async function deliverPendingEmails(limit = 25) {
  const env = getOptionalEnv();
  const pending = await db
    .select()
    .from(emailOutbox)
    .where(and(eq(emailOutbox.status, "pending"), lte(emailOutbox.availableAt, new Date())))
    .orderBy(asc(emailOutbox.availableAt))
    .limit(limit);

  if (!env.RESEND_API_KEY) return { processed: 0, skipped: pending.length, reason: "RESEND_API_KEY is not configured" };
  const resend = new Resend(env.RESEND_API_KEY);
  let sent = 0;

  for (const message of pending) {
    try {
      await resend.emails.send({
        from: env.EMAIL_FROM ?? "Vela AI Academy <academy@example.com>",
        to: message.to,
        subject: message.subject,
        html: emailMarkup(message.template, message.payload),
      });
      await db.update(emailOutbox).set({
        status: "sent",
        sentAt: new Date(),
        attempts: message.attempts + 1,
        lastError: null,
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
  return { processed: pending.length, sent };
}
