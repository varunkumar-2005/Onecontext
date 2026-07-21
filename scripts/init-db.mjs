import fs from "node:fs/promises";
import pg from "pg";

try {
  const localEnv = await fs.readFile(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of localEnv.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
} catch {}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not configured. Copy .env.example to .env.local and set your PostgreSQL credentials.");
  process.exit(1);
}

const schema = await fs.readFile(new URL("../infra/db/schema.sql", import.meta.url), "utf8");
const targetUrl = new URL(process.env.DATABASE_URL);
const databaseName = targetUrl.pathname.replace(/^\//, "") || "onecontext";
targetUrl.pathname = "/postgres";
const admin = new pg.Client({ connectionString: targetUrl.toString() });
await admin.connect();
const existing = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName]);
if (existing.rowCount === 0) {
  const safeName = databaseName.replace(/[^a-zA-Z0-9_]/g, "");
  await admin.query(`CREATE DATABASE "${safeName}"`);
  console.log(`Created PostgreSQL database: ${safeName}`);
}
await admin.end();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
await pool.query(schema);
await pool.end();
console.log("OneContext PostgreSQL schema initialized.");
