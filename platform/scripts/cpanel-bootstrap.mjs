import { createClient } from "@libsql/client";
import { chmod, mkdir, readFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const dataDirectory = process.env.ALESYA_DATA_DIR || path.join(os.homedir(), "alesya-data");
process.env.TURSO_DATABASE_URL ||= `file:${path.join(dataDirectory, "alesya.db")}`;
process.env.TRUSTED_PROXY_IP_HEADER ||= "x-forwarded-for";
process.env.NODE_ENV = "production";

if (process.env.TURSO_DATABASE_URL.startsWith("file:")) {
  const databasePath = fileURLToPath(new URL(process.env.TURSO_DATABASE_URL));
  await mkdir(path.dirname(databasePath), { recursive: true, mode: 0o700 });
}

const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
try {
  await client.execute("CREATE TABLE IF NOT EXISTS alesya_migrations (id TEXT PRIMARY KEY NOT NULL, applied_at INTEGER NOT NULL)");
  const migrationsDirectory = path.join(root, "drizzle");
  const migrations = (await readdir(migrationsDirectory)).filter((name) => name.endsWith(".sql")).sort();
  for (const migration of migrations) {
    const existing = await client.execute({ sql: "SELECT id FROM alesya_migrations WHERE id = ? LIMIT 1", args: [migration] });
    if (existing.rows.length) continue;
    const source = await readFile(path.join(migrationsDirectory, migration), "utf8");
    const statements = source.split("--> statement-breakpoint").map((statement) => statement.trim()).filter(Boolean);
    await client.batch([
      ...statements,
      { sql: "INSERT INTO alesya_migrations (id, applied_at) VALUES (?, ?)", args: [migration, Date.now()] },
    ], "write");
  }
} finally {
  client.close();
}

if (process.env.TURSO_DATABASE_URL.startsWith("file:")) {
  await chmod(fileURLToPath(new URL(process.env.TURSO_DATABASE_URL)), 0o600).catch(() => undefined);
}

await import("./next-server.mjs");
