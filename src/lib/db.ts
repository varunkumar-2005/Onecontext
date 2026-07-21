import { Pool, type QueryResultRow } from "pg";

let pool: Pool | undefined;

export function getDatabase() {
  if (!process.env.DATABASE_URL) return undefined;
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 10_000 });
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []) {
  const database = getDatabase();
  if (!database) throw new Error("DATABASE_URL is not configured.");
  return database.query<T>(text, values);
}

export async function checkDatabase() {
  const database = getDatabase();
  if (!database) return { configured: false, connected: false };
  await database.query("SELECT 1");
  return { configured: true, connected: true };
}
