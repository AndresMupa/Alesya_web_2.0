import "server-only";
import { copyFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

/** Demo previews ship a seeded SQLite file; the deployment bundle is read-only, so it is copied to /tmp once per instance. */
export const demoDatabase = () => process.env.DEMO_DATABASE === "1" && !process.env.TURSO_DATABASE_URL;

export function databaseUrl() {
  if (demoDatabase()) return demoUrl();
  if (process.env.TURSO_DATABASE_URL) return process.env.TURSO_DATABASE_URL;
  if (process.env.NODE_ENV === "production") {
    const dataDirectory = process.env.ALESYA_DATA_DIR || path.join(os.homedir(), "alesya-data");
    return `file:${path.join(dataDirectory, "alesya.db")}`;
  }
  return "file:.local/alesya.db";
}

function demoUrl() {
  const target = "/tmp/alesya-demo.db";
  if (!existsSync(target)) copyFileSync(path.join(process.cwd(), ".demo/alesya-demo.db"), target);
  return `file:${target}`;
}

type Database = ReturnType<typeof drizzle<typeof schema>>;
/** Una sola conexión por proceso (en globalThis para sobrevivir a la recarga en caliente de desarrollo). */
const shared = globalThis as typeof globalThis & { __alesyaDb?: { url: string; db: Database } };

/**
 * Conexión compartida a la base. Antes se abría un cliente nuevo en cada consulta (abrir el archivo SQLite cuesta
 * ~2 ms frente a ~0,2 ms de una consulta) y nunca se cerraba. Las transacciones y lotes de libSQL toman su propia
 * conexión, así que compartir el cliente es seguro.
 */
export function getDb(): Database {
  const url = databaseUrl();
  if (process.env.VERCEL && !demoDatabase() && url.startsWith("file:")) {
    throw new Error("Configure a persistent TURSO_DATABASE_URL before enabling commerce.");
  }
  const cached = shared.__alesyaDb;
  if (cached?.url === url) return cached.db;
  const db = drizzle(createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN }), { schema });
  shared.__alesyaDb = { url, db };
  return db;
}
