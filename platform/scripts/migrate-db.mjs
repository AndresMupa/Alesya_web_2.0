import { createClient } from "@libsql/client";
import { mkdir } from "node:fs/promises";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
await mkdir(".local", { recursive: true });
const client = createClient({ url: process.env.TURSO_DATABASE_URL || "file:.local/alesya.db", authToken: process.env.TURSO_AUTH_TOKEN });
await migrate(drizzle(client), { migrationsFolder: "drizzle" });
client.close();
console.log("Database migrations applied.");
