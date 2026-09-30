// Runs before `next build`. With DEMO_DATABASE=1 it bakes a seeded SQLite file into the build
// (.demo/alesya-demo.db) so a preview deployment can be tested without Turso.
import { mkdir, rm } from "node:fs/promises";
import { seedDemo } from "./seed-demo.mjs";

if (process.env.DEMO_DATABASE === "1") {
  await rm(".demo", { recursive: true, force: true });
  await mkdir(".demo", { recursive: true });
  await seedDemo("file:.demo/alesya-demo.db");
}
