// Local production server: `npm run build` first, then `npm start`. Applies pending
// migrations to the same database `db/index.ts` resolves in production, then boots the
// standalone server. The server chdirs into `.next/standalone`, so paths must be absolute.
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const server = path.join(root, ".next/standalone/server.js");
if (!existsSync(server)) {
  console.error("No existe .next/standalone/server.js. Ejecuta primero `npm run build` y vuelve a intentar `npm start`.");
  process.exit(1);
}

const demo = process.env.DEMO_DATABASE === "1" && !process.env.TURSO_DATABASE_URL;
if (!process.env.TURSO_DATABASE_URL && !process.env.ALESYA_DATA_DIR) process.env.ALESYA_DATA_DIR = path.join(root, ".local");

if (!demo) {
  let url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    const dataDirectory = path.resolve(root, process.env.ALESYA_DATA_DIR);
    process.env.ALESYA_DATA_DIR = dataDirectory;
    await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
    url = `file:${path.join(dataDirectory, "alesya.db")}`;
  }
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  await migrate(drizzle(client), { migrationsFolder: path.join(root, "drizzle") });
  client.close();
  console.log(process.env.TURSO_DATABASE_URL ? "Migraciones aplicadas en Turso." : `Migraciones aplicadas en ${url}.`);
}

await import(pathToFileURL(server).href);
