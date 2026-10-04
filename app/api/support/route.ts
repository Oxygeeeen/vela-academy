import { NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { notifications, supportMessages, supportTickets, users } from "@/db/schema";
import { apiError, paginationFrom } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security";
import { writeAuditEvent } from "@/lib/audit";
import { queueAndDeliverEmail } from "@/lib/email";
import { getOptionalEnv } from "@/lib/env";

const createSchema = z.object({
  subject: z.string().trim().min(5).max(240),
  category: z.enum(["technical", "curriculum", "assessment", "account", "accessibility", "other"]),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  message: z.string().trim().min(10).max(20_000),
});

export async function GET(request: Request) {
  try {
    const actor = await requireUser();
    const { pageSize, offset, page } = paginationFrom(request.url);
    const privileged = ["owner", "admin", "trainer"].includes(actor.role);
    const condition = privileged
      ? eq(supportTickets.organizationId, actor.organizationId)
      : and(eq(supportTickets.organizationId, actor.organizationId), eq(supportTickets.requesterId, actor.id));
    const rows = await db.select({
      id: supportTickets.id,
      organizationId: supportTickets.organizationId,
      requesterId: supportTickets.requesterId,
      requesterName: users.fullName,
      requesterEmail: users.email,
      subject: supportTickets.subject,
      category: supportTickets.category,
      priority: supportTickets.priority,
      status: supportTickets.status,
      assignedTo: supportTickets.assignedTo,
      createdAt: supportTickets.createdAt,
      updatedAt: supportTickets.updatedAt,
    }).from(supportTickets)
      .innerJoin(users, eq(users.id, supportTickets.requesterId))
      .where(condition)
      .orderBy(desc(supportTickets.updatedAt)).limit(pageSize).offset(offset);
    return NextResponse.json({ data: rows, pagination: { page, pageSize } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    const actor = await requireUser();
    const input = createSchema.parse(await request.json());
    const ticket = await db.transaction(async (tx) => {
      const created = await tx.insert(supportTickets).values({
        organizationId: actor.organizationId,
        requesterId: actor.id,
        subject: input.subject,
        category: input.category,
        priority: input.priority,
      }).returning();
      await tx.insert(supportMessages).values({
        ticketId: created[0].id,
        authorId: actor.id,
        body: input.message,
      });
      const staff = await tx.select({ id: users.id }).from(users).where(and(
        eq(users.organizationId, actor.organizationId),
        inArray(users.role, ["owner", "admin", "trainer"]),
        eq(users.status, "active"),
      ));
      const recipients = staff.filter((member) => member.id !== actor.id);
      if (recipients.length) {
        await tx.insert(notifications).values(recipients.map((member) => ({
            organizationId: actor.organizationId,
            userId: member.id,
            kind: "support_ticket_created",
            title: "New support request",
            body: `${actor.fullName}: ${input.subject}`,
            actionUrl: `/?view=support&ticket=${created[0].id}`,
          })));
      }
      return created[0];
    });
    await writeAuditEvent({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: "support.ticket_created",
      entityType: "support_ticket",
      entityId: ticket.id,
      metadata: { priority: input.priority, category: input.category },
    });
    const environment = getOptionalEnv();
    await queueAndDeliverEmail({
      organizationId: actor.organizationId,
      to: environment.SUPPORT_EMAIL ?? "vela@scaleworkagency.com",
      subject: `[${input.priority.toUpperCase()}] New Vela support request: ${input.subject}`,
      template: "support_ticket_created",
      payload: {
        heading: "New learner support request",
        message: `${actor.fullName} (${actor.email}) submitted a ${input.category} request: ${input.message}`,
        details: [
          { label: "Ticket reference", value: ticket.id },
          { label: "Priority", value: input.priority },
          { label: "Category", value: input.category },
        ],
        actionUrl: `${environment.APP_URL ?? new URL(request.url).origin}/?view=support&ticket=${ticket.id}`,
        actionLabel: "Open support request",
      },
    });
    return NextResponse.json({ data: ticket }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
