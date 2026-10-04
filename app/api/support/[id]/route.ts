import { NextResponse } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { notifications, supportMessages, supportTickets, users } from "@/db/schema";
import { apiError, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security";
import { queueAndDeliverEmail } from "@/lib/email";
import { getOptionalEnv } from "@/lib/env";

const schema = z.object({
  message: z.string().trim().min(2).max(20_000).optional(),
  status: z.enum(["open", "in_progress", "waiting", "resolved", "closed"]).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
});

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireUser();
    const { id } = await context.params;
    const [ticket] = await db.select().from(supportTickets).where(and(
      eq(supportTickets.id, id),
      eq(supportTickets.organizationId, actor.organizationId),
    )).limit(1);
    if (!ticket || (actor.role === "student" && ticket.requesterId !== actor.id)) throw new ApiError("Ticket not found.", 404);
    const messages = await db.select({
      id: supportMessages.id,
      ticketId: supportMessages.ticketId,
      authorId: supportMessages.authorId,
      authorName: users.fullName,
      authorRole: users.role,
      body: supportMessages.body,
      createdAt: supportMessages.createdAt,
    }).from(supportMessages)
      .innerJoin(users, eq(users.id, supportMessages.authorId))
      .where(eq(supportMessages.ticketId, id))
      .orderBy(asc(supportMessages.createdAt));
    return NextResponse.json({ ticket, messages });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await assertSameOrigin();
    const actor = await requireUser();
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    const [ticket] = await db.select().from(supportTickets).where(and(
      eq(supportTickets.id, id),
      eq(supportTickets.organizationId, actor.organizationId),
    )).limit(1);
    if (!ticket || (actor.role === "student" && ticket.requesterId !== actor.id)) throw new ApiError("Ticket not found.", 404);
    if ((input.status || input.assignedTo !== undefined) && !["owner", "admin", "trainer"].includes(actor.role)) {
      throw new ApiError("Only support staff can change ticket status or assignment.", 403);
    }
    await db.transaction(async (tx) => {
      if (input.message) await tx.insert(supportMessages).values({ ticketId: id, authorId: actor.id, body: input.message });
      if (input.status || input.assignedTo !== undefined) {
        await tx.update(supportTickets).set({
          status: input.status,
          assignedTo: input.assignedTo,
          updatedAt: new Date(),
        }).where(eq(supportTickets.id, id));
      } else if (input.message) {
        await tx.update(supportTickets).set({ updatedAt: new Date() }).where(eq(supportTickets.id, id));
      }
      if (input.message) {
        if (actor.role === "student") {
          const staff = await tx.select({ id: users.id }).from(users).where(and(
            eq(users.organizationId, actor.organizationId),
            inArray(users.role, ["owner", "admin", "trainer"]),
            eq(users.status, "active"),
          ));
          if (staff.length) await tx.insert(notifications).values(staff.map((member) => ({
            organizationId: actor.organizationId,
            userId: member.id,
            kind: "support_reply",
            title: "Student replied to support",
            body: ticket.subject,
            actionUrl: `/?view=support&ticket=${id}`,
          })));
        } else if (ticket.requesterId !== actor.id) {
          await tx.insert(notifications).values({
            organizationId: actor.organizationId,
            userId: ticket.requesterId,
            kind: "support_response",
            title: "Support replied",
            body: ticket.subject,
            actionUrl: `/?view=support&ticket=${id}`,
          });
        }
      }
    });
    if (input.message) {
      const environment = getOptionalEnv();
      if (actor.role === "student") {
        await queueAndDeliverEmail({
          organizationId: actor.organizationId,
          to: environment.SUPPORT_EMAIL ?? "vela@scaleworkagency.com",
          subject: `Student replied: ${ticket.subject}`,
          template: "support_student_reply",
          payload: {
            heading: "A student replied to support",
            message: `${actor.fullName} replied: ${input.message}`,
            actionUrl: `${environment.APP_URL ?? new URL(request.url).origin}/?view=support&ticket=${id}`,
            actionLabel: "Open conversation",
          },
        });
      } else if (ticket.requesterId !== actor.id) {
        const [requester] = await db.select({ email: users.email, fullName: users.fullName }).from(users).where(eq(users.id, ticket.requesterId)).limit(1);
        if (requester) {
          await queueAndDeliverEmail({
            organizationId: actor.organizationId,
            to: requester.email,
            subject: `Support replied: ${ticket.subject}`,
            template: "support_admin_reply",
            payload: {
              heading: "Your support request has a new reply",
              message: `Hello ${requester.fullName}. ${actor.fullName} replied: ${input.message}`,
              actionUrl: `${environment.APP_URL ?? new URL(request.url).origin}/?view=support&ticket=${id}`,
              actionLabel: "View support reply",
            },
          });
        }
      }
    }
    return NextResponse.json({ ok: true, updatedAt: new Date().toISOString() });
  } catch (error) {
    return apiError(error);
  }
}
