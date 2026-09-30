import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const checkedAt = new Date().toISOString();
  try {
    await db.execute(sql`select 1 as healthy`);
    return NextResponse.json(
      { status: "ok", database: "reachable", checkedAt },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "degraded", database: "unreachable", checkedAt },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
