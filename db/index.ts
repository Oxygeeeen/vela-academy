import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type SqlClient = ReturnType<typeof postgres>;

const globalForDatabase = globalThis as typeof globalThis & {
  velaSql?: SqlClient;
};

export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for database operations.");
  }
  return createDatabase(connectionString);
}

function createDatabase(connectionString: string) {
  const sql =
    globalForDatabase.velaSql ??
    postgres(connectionString, {
      max: process.env.NODE_ENV === "production" ? 10 : 3,
      idle_timeout: 20,
      connect_timeout: 15,
      prepare: false,
      transform: { undefined: null },
    });

  if (process.env.NODE_ENV !== "production") {
    globalForDatabase.velaSql = sql;
  }

  return drizzle(sql, { schema });
}

export type Database = ReturnType<typeof getDb>;

export const db = createDatabase(
  process.env.DATABASE_URL ?? "postgres://vela:vela@127.0.0.1:5432/vela_build",
);
