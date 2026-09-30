import "server-only";

import { db } from "@/db";
import { notifications } from "@/db/schema";

export async function createNotification(input: {
  organizationId: string;
  userId: string;
  kind: string;
  title: string;
  body: string;
  actionUrl?: string;
}) {
  const [notification] = await db.insert(notifications).values(input).returning();
  return notification;
}

export async function createNotifications(inputs: Array<{
  organizationId: string;
  userId: string;
  kind: string;
  title: string;
  body: string;
  actionUrl?: string;
}>) {
  if (!inputs.length) return [];
  return db.insert(notifications).values(inputs).returning();
}
