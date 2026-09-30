// Runs after `next build`. The standalone bundle ships only the server and its traced
// dependencies, so the static assets and `public/` have to be placed next to it before
// `node .next/standalone/server.js` can serve a complete site.
import { cp, stat } from "node:fs/promises";

const copy = async (from, to) => {
  if (!(await stat(from).catch(() => null))) return;
  await cp(from, to, { recursive: true, force: true });
};

await copy(".next/static", ".next/standalone/.next/static");
await copy("public", ".next/standalone/public");
console.log("Standalone bundle completed with static assets.");
