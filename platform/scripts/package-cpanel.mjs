#!/usr/bin/env node
// Builds the cPanel ("Setup Node.js App" / Phusion Passenger) deployment package.
//
//   npm run package:cpanel            (from platform/)
//   node scripts/package-cpanel.mjs [--no-smoke] [--keep]
//
// Everything that produces or touches native binaries runs inside a linux/amd64 glibc
// container (Debian bookworm, Node pinned to the cPanel version), so libsql/sharp are the
// Linux x86-64 builds regardless of the host OS. The host platform/.next and
// platform/node_modules are never mounted or written: a filtered copy of the sources is
// staged in the OS temp dir and `docker cp`-ed into the container.
//
// Output: <git root>/outputs/alesya-cpanel-linux-x64-<YYYY-MM-DD>.tar.gz (+ .sha256).
// The archive is validated (forbidden content, ELF x86-64 native modules, secret scan,
// no symlinks / unsafe paths) and smoke-tested in a fresh container before it is kept.
//
// Package layout (extract into the cPanel application root, e.g. ~/alesya-platform):
//   server.js          CommonJS startup file for Passenger -> import("./bootstrap.mjs")
//   bootstrap.mjs      scripts/cpanel-bootstrap.mjs (creates SQLite, applies migrations)
//   next-server.mjs    Next.js standalone server.js (ESM), renamed
//   drizzle/           SQL migrations read by bootstrap.mjs
//   .next/ node_modules/ public/ package.json ("type": "commonjs")
import { spawnSync } from "node:child_process";
import { createHash, randomBytes, scryptSync } from "node:crypto";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { cp, mkdir, mkdtemp, rename, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const IMAGE = process.env.ALESYA_PKG_IMAGE || "node:22.23.2-bookworm-slim";
const DOCKER_PLATFORM = "linux/amd64";
const BUILD_ROOT = "/opt/alesya-build"; // Inside the container; shows up in embedded Next paths.
const PKG_ROOT = "/opt/alesya-pkg";

const args = new Set(process.argv.slice(2));
const runSmoke = !args.has("--no-smoke");
const keepContainers = args.has("--keep");

const platformDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gitRoot = path.resolve(platformDir, "..");
const outDir = path.join(gitRoot, "outputs");
const date = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time
const baseName = `alesya-cpanel-linux-x64-${date}`;
const finalArchive = path.join(outDir, `${baseName}.tar.gz`);
const partialArchive = `${finalArchive}.partial`;
const runId = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
const buildContainer = `alesya-pkg-build-${runId}`;
const smokeContainer = `alesya-pkg-smoke-${runId}`;
const containers = [];

// Top-level entries of platform/ that never go into the build context.
const EXCLUDED_TOP = new Set([
  "node_modules", ".next", ".local", ".demo", ".vercel", ".wrangler", ".openai", "outputs",
  ".git", ".vinext", ".sites-runtime", ".agents", ".codex", "work", "dist", "out", "coverage",
]);
const excludedAnywhere = (name) =>
  name === "node_modules" || name === ".DS_Store" || name.endsWith(".tsbuildinfo") ||
  (name.startsWith(".env") && name !== ".env.example") ||
  /\.(db|sqlite\d?)(-journal|-wal|-shm)?$/i.test(name);

const log = (message) => console.log(`\n[package-cpanel] ${message}`);
const fail = (message) => { const error = new Error(message); error.packaging = true; throw error; };

function docker(argv, { input, inherit = false, allowFail = false } = {}) {
  const result = spawnSync("docker", argv, {
    input,
    encoding: "utf8",
    stdio: inherit ? ["pipe", "inherit", "inherit"] : ["pipe", "pipe", "pipe"],
    maxBuffer: 512 * 1024 * 1024,
    env: { ...process.env, MSYS_NO_PATHCONV: "1" },
    windowsHide: true,
  });
  if (result.error) fail(`docker ${argv[0]} could not run: ${result.error.message}`);
  if (result.status !== 0 && !allowFail) {
    fail(`docker ${argv.slice(0, 3).join(" ")} … exited with ${result.status}${inherit ? "" : `\n${result.stderr || result.stdout}`}`);
  }
  return result;
}

const sha256File = (file) => new Promise((resolve, reject) => {
  const hash = createHash("sha256");
  createReadStream(file).on("data", (chunk) => hash.update(chunk)).on("error", reject).on("end", () => resolve(hash.digest("hex")));
});

function readEnvSecrets(file) {
  if (!existsSync(file)) return [];
  const values = [];
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (value.length < 8) continue; // Too short to be a secret; would only produce noise.
    values.push(value);
    // Also look for the halves of composite values such as "salt:hash".
    for (const part of value.split(":")) if (part.length >= 16 && part !== value) values.push(part);
  }
  return [...new Set(values)];
}

// ---------------------------------------------------------------------------------------
// Container-side programs. They are serialized with Function#toString, so they must be
// self-contained (dynamic imports only, no closures over this module).

async function containerVerify() {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { execFileSync } = await import("node:child_process");
  const input = JSON.parse(fs.readFileSync(0, "utf8"));
  const { archive, root, buildRoot, hostPaths, secrets } = input;
  const errors = [];
  const report = {};

  const tar = (...argv) => execFileSync("tar", argv, { encoding: "utf8", maxBuffer: 1 << 30 }).split("\n").filter(Boolean);
  const names = tar("-tzf", archive);
  const verbose = tar("-tvzf", archive);
  report.entries = names.length;
  report.entryTypes = {};
  for (const line of verbose) report.entryTypes[line[0]] = (report.entryTypes[line[0]] || 0) + 1;
  const linkEntries = verbose.filter((line) => line[0] !== "-" && line[0] !== "d");
  if (linkEntries.length) errors.push(`archive has ${linkEntries.length} non-regular entries (symlinks/hardlinks/devices): ${linkEntries.slice(0, 5).join(" | ")}`);
  const unsafe = names.filter((name) => name.startsWith("/") || /^[A-Za-z]:/.test(name) || name.split("/").includes(".."));
  if (unsafe.length) errors.push(`unsafe entry paths: ${unsafe.slice(0, 5).join(", ")}`);
  report.unsafeEntryPaths = unsafe.length;

  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  execFileSync("tar", ["-xzf", archive, "-C", root]);

  const forbidden = [];
  const nativeModules = [];
  const otherElf = {};
  const buildRootHits = [];
  const hostPathHits = [];
  let secretHits = 0;
  let totalBytes = 0;
  const bytesByTop = {};
  const needles = secrets.map((value) => Buffer.from(value));
  const buildNeedle = Buffer.from(buildRoot);
  const hostNeedles = hostPaths.map((value) => Buffer.from(value));

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(root, full).split(path.sep).join("/");
      const segments = rel.split("/");
      const name = entry.name;
      if (entry.isSymbolicLink()) { forbidden.push(`${rel} (symlink)`); continue; }
      if (name.startsWith(".env")) forbidden.push(rel);
      if (entry.isDirectory() && [".local", ".demo", ".git", "outputs", ".vercel", ".wrangler", ".openai"].includes(name)) forbidden.push(rel);
      if (/\.(db|sqlite\d?)(-journal|-wal|-shm)?$/i.test(name) || /\.sqlite/i.test(name)) forbidden.push(rel);
      if (entry.isDirectory() && segments.includes("node_modules") && /(darwin|win32|musl|android|freebsd|arm64|wasm32)/i.test(name)) forbidden.push(`${rel} (foreign native package)`);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.isFile()) { forbidden.push(`${rel} (special file)`); continue; }
      const data = fs.readFileSync(full);
      totalBytes += data.length;
      const top = segments.length > 1 ? segments[0] : "(root files)";
      bytesByTop[top] = (bytesByTop[top] || 0) + data.length;
      const isElf = data.length > 20 && data[0] === 0x7f && data[1] === 0x45 && data[2] === 0x4c && data[3] === 0x46;
      const machine = isElf ? data.readUInt16LE(18) : null;
      if (name.endsWith(".node")) {
        const ok = isElf && data[4] === 2 && machine === 0x3e;
        nativeModules.push({ file: rel, elf: isElf, class64: isElf && data[4] === 2, eMachine: machine === null ? null : `0x${machine.toString(16)}`, ok });
        if (!ok) errors.push(`native module is not ELF x86-64: ${rel}`);
      } else if (isElf) {
        otherElf[rel] = `0x${machine.toString(16)}`;
        if (machine !== 0x3e) errors.push(`ELF binary for another architecture: ${rel}`);
      }
      for (const needle of needles) if (data.indexOf(needle) !== -1) secretHits += 1;
      if (data.indexOf(buildNeedle) !== -1) buildRootHits.push(rel);
      for (const needle of hostNeedles) if (data.indexOf(needle) !== -1) { hostPathHits.push(rel); break; }
    }
  };
  walk(root);

  if (forbidden.length) errors.push(`forbidden content: ${forbidden.slice(0, 20).join(", ")}${forbidden.length > 20 ? " …" : ""}`);
  if (secretHits) errors.push(`secret scan: ${secretHits} match(es) of local secret values`);
  if (hostPathHits.length) errors.push(`host (Windows) paths embedded in: ${hostPathHits.slice(0, 10).join(", ")}`);

  const must = ["server.js", "bootstrap.mjs", "next-server.mjs", "package.json", ".next/BUILD_ID", ".next/package.json",
    ".next/required-server-files.json", "node_modules/next/package.json", "public/favicon.svg"];
  for (const file of must) if (!fs.existsSync(path.join(root, file))) errors.push(`missing ${file}`);
  const staticDir = path.join(root, ".next/static");
  const staticCount = fs.existsSync(staticDir) ? fs.readdirSync(staticDir, { recursive: true }).length : 0;
  if (!staticCount) errors.push("missing or empty .next/static");
  const migrations = fs.existsSync(path.join(root, "drizzle")) ? fs.readdirSync(path.join(root, "drizzle")).filter((f) => f.endsWith(".sql")) : [];
  if (!migrations.length) errors.push("no drizzle/*.sql migrations");
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  if (pkg.type !== "commonjs") errors.push(`package.json type is ${pkg.type}, expected commonjs`);
  const nextPkg = JSON.parse(fs.readFileSync(path.join(root, ".next/package.json"), "utf8"));
  const serverJs = fs.readFileSync(path.join(root, "server.js"), "utf8");
  if (!/import\(["']\.\/bootstrap\.mjs["']\)/.test(serverJs) || /^\s*(import|export)\s/m.test(serverJs)) errors.push("server.js is not the CommonJS bootstrap shim");
  const bootstrap = fs.readFileSync(path.join(root, "bootstrap.mjs"), "utf8");
  if (!bootstrap.includes("./next-server.mjs")) errors.push("bootstrap.mjs does not import ./next-server.mjs");

  const required = JSON.parse(fs.readFileSync(path.join(root, ".next/required-server-files.json"), "utf8"));
  const nextServer = fs.readFileSync(path.join(root, "next-server.mjs"), "utf8");
  report.embeddedBuildPaths = {
    buildRoot,
    filesContainingBuildRoot: buildRootHits.length,
    files: buildRootHits.slice(0, 15),
    requiredServerFiles: { appDir: required.appDir, outputFileTracingRoot: required.config?.outputFileTracingRoot, turbopackRoot: required.config?.turbopack?.root },
    nextServerOutputFileTracingRoot: /"outputFileTracingRoot":"([^"]*)"/.exec(nextServer)?.[1] ?? null,
  };
  report.hostPathFiles = hostPathHits.length;
  report.forbidden = forbidden.length;
  report.nativeModules = nativeModules;
  report.otherElfBinaries = otherElf;
  report.secretValuesScanned = needles.length;
  report.secretMatches = secretHits;
  report.migrations = migrations;
  report.staticFiles = staticCount;
  report.packageType = pkg.type;
  report.nextPackageType = nextPkg.type;
  report.bytes = { total: totalBytes, byTop: bytesByTop };
  report.errors = errors;
  process.stdout.write(JSON.stringify(report));
}

async function containerSmoke() {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { DatabaseSync } = await import("node:sqlite");
  const [mode, ip, priorIp] = process.argv.slice(2);
  const app = "/home/app";
  const base = "http://127.0.0.1:3000";
  const out = { mode, ready: false };
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const request = async (pathname, init = {}) => {
    const response = await fetch(base + pathname, { redirect: "manual", ...init });
    await response.arrayBuffer();
    return response;
  };
  const started = Date.now();
  while (Date.now() - started < 120_000) {
    try { await request("/api/products"); out.ready = true; break; } catch { await sleep(500); }
  }
  out.readyAfterMs = Date.now() - started;
  if (!out.ready) { process.stdout.write(JSON.stringify(out)); return; }

  const dbFile = path.join(process.env.ALESYA_DATA_DIR, "alesya.db");
  out.dbExists = fs.existsSync(dbFile);
  out.migrationFiles = fs.readdirSync(path.join(app, "drizzle")).filter((f) => f.endsWith(".sql")).length;
  const count = (sql) => { const db = new DatabaseSync(dbFile, { readOnly: true }); try { return Number(Object.values(db.prepare(sql).get())[0]); } finally { db.close(); } };
  out.migrationRows = out.dbExists ? count("SELECT COUNT(*) FROM alesya_migrations") : null;
  out.leadRowsBefore = out.dbExists ? count("SELECT COUNT(*) FROM leads") : null;

  const home = await request("/");
  out.home = home.status;
  out.securityHeaders = Object.fromEntries(["x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy"].map((h) => [h, home.headers.get(h)]));
  for (const page of ["/catalogo", "/proyectos", "/api/products", "/admin/login"]) out[page] = (await request(page)).status;
  const admin = await request("/admin");
  out["/admin"] = { status: admin.status, location: admin.headers.get("location") };
  const chunks = fs.readdirSync(path.join(app, ".next/static/chunks")).filter((f) => f.endsWith(".js"));
  const asset = `/_next/static/chunks/${chunks[0]}`;
  const assetResponse = await request(asset);
  out.staticAsset = { path: asset, status: assetResponse.status, cacheControl: assetResponse.headers.get("cache-control") };
  out.publicAsset = { path: "/favicon.svg", status: (await request("/favicon.svg")).status };

  const lead = JSON.stringify({ name: "Smoke Test", organization: "Alesya QA", email: "qa@example.com", message: "Prueba automatizada del paquete cPanel." });
  const post = (headers) => request("/api/leads", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: lead });
  out.leadStatuses = [];
  for (let i = 0; i < 10; i += 1) {
    const status = (await post({ "x-forwarded-for": ip })).status;
    out.leadStatuses.push(status);
    if (status !== 201) break;
  }
  out.noHeaderStatus = (await post({})).status;
  out.invalidHeaderStatus = (await post({ "x-forwarded-for": "not-an-ip" })).status;
  if (priorIp) out.priorIpStatus = (await post({ "x-forwarded-for": priorIp })).status;
  out.leadRowsAfter = count("SELECT COUNT(*) FROM leads");
  process.stdout.write(JSON.stringify(out));
}

const program = (fn, ...rest) => `${fn.toString()}\n${fn.name}(${rest.join(",")}).catch((error) => { console.error(error); process.exit(1); });\n`;

// Startup file for Passenger. CommonJS on purpose: Passenger require()s it, and
// bootstrap.mjs uses top-level await (require(esm) would throw ERR_REQUIRE_ASYNC_MODULE).
const SERVER_JS = `"use strict";
// cPanel / Phusion Passenger startup file (CommonJS). Works with \`node server.js\` and require().
// bootstrap.mjs prepares the SQLite database, applies drizzle/ migrations and starts Next.js.
import("./bootstrap.mjs").catch((error) => {
  console.error(error);
  process.exit(1);
});
`;

const ASSEMBLE_SH = `set -eu
B=${BUILD_ROOT}; P=${PKG_ROOT}
test -f "$B/.next/standalone/server.js" || { echo "standalone server.js missing (is output: 'standalone' set?)" >&2; exit 1; }
rm -rf "$P" /opt/out; mkdir -p "$P" /opt/out
cp -a "$B/.next/standalone/." "$P/"
# Ensure static assets and public/ are present even if postbuild did not copy them.
mkdir -p "$P/.next/static"; cp -a "$B/.next/static/." "$P/.next/static/"
if [ -d "$B/public" ]; then mkdir -p "$P/public"; cp -a "$B/public/." "$P/public/"; fi
mv "$P/server.js" "$P/next-server.mjs"
cp "$B/scripts/cpanel-bootstrap.mjs" "$P/bootstrap.mjs"
mkdir -p "$P/drizzle"; cp -a "$B/drizzle/." "$P/drizzle/"
cp /opt/pkg-tools/server.js "$P/server.js"
node -e '
  const fs = require("fs"); const file = process.argv[1];
  const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
  pkg.type = "commonjs"; delete pkg.devDependencies; pkg.scripts = { start: "node server.js" };
  fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\\n");' "$P/package.json"
# npm installs every libc variant of optional native deps and Next traces them all; cPanel is
# glibc x86-64, so drop musl/macOS/Windows builds (libsql and sharp pick theirs via detect-libc).
for dir in $(find "$P/node_modules" "$P/.next/node_modules" -mindepth 1 -maxdepth 2 -type d \\( -name "*musl*" -o -name "*darwin*" -o -name "*win32*" \\) 2>/dev/null); do
  echo "pruned foreign native package: \${dir#$P/}"; rm -rf "$dir"
done
# No .bin dirs (symlinks, useless at runtime).
find "$P" -type d -name .bin -path "*/node_modules/*" -prune -exec rm -rf {} +
# Replace remaining symlinks (e.g. .next/node_modules/@libsql/client-<hash>) with real copies,
# as long as they resolve inside the package. cPanel's extractor must never see a link.
find "$P" -type l | while read -r link; do
  target=$(readlink -f "$link" || true)
  case "$target" in "$P"/*) ;; *) echo "symlink escapes package or is broken: $link -> $target" >&2; exit 1;; esac
  echo "dereferenced symlink: \${link#$P/} -> \${target#$P/}"
  rm "$link"; cp -a "$target" "$link"
done
test -z "$(find "$P" -type l)" || { echo "symlinks remain" >&2; exit 1; }
chmod -R u+rwX,go+rX,go-w "$P"
cd "$P"
tar --sort=name --owner=0 --group=0 --numeric-owner -cf - $(ls -A) | gzip -n -9 > /opt/out/package.tar.gz
sha256sum /opt/out/package.tar.gz
for d in "$P" "$P/node_modules" "$P/.next" "$P/public"; do du -sh "$d"; done | sed "s#$P#<pkg>#"
ls -l /opt/out/package.tar.gz | awk '{print "archive bytes: " $5}'
`;

async function stageSources(stagingRoot) {
  const target = path.join(stagingRoot, "alesya-build");
  await cp(platformDir, target, {
    recursive: true,
    filter: (source) => {
      const rel = path.relative(platformDir, source);
      if (!rel) return true;
      const segments = rel.split(path.sep);
      if (segments.length === 1 && EXCLUDED_TOP.has(segments[0])) return false;
      return !excludedAnywhere(segments.at(-1));
    },
  });
  const tools = path.join(stagingRoot, "pkg-tools");
  await mkdir(tools, { recursive: true });
  await writeFile(path.join(tools, "server.js"), SERVER_JS);
  await writeFile(path.join(tools, "assemble.sh"), ASSEMBLE_SH);
  await writeFile(path.join(tools, "verify.mjs"), program(containerVerify));
  await writeFile(path.join(tools, "smoke.mjs"), program(containerSmoke));
  return { source: target, tools };
}

function startContainer(name) {
  docker(["create", "--platform", DOCKER_PLATFORM, "--name", name, "-e", "NEXT_TELEMETRY_DISABLED=1", IMAGE, "sleep", "infinity"]);
  containers.push(name);
  docker(["start", name]);
  const arch = docker(["exec", name, "sh", "-c", "uname -m; node -p 'process.version + \" \" + process.arch'; ldd --version 2>&1 | head -1"]).stdout.trim();
  console.log(`${name}: ${arch.replace(/\n/g, " | ")}`);
}

function smokeRun(mode, ip, priorIp, env) {
  const command = mode === "require" ? `node -e "require('./server.js')"` : "node server.js";
  const envArgs = Object.entries(env).flatMap(([key, value]) => ["-e", `${key}=${value}`]);
  docker(["exec", "-d", "-w", "/home/app", ...envArgs, smokeContainer, "sh", "-c", `echo $$ > /tmp/server.pid; exec ${command} > /tmp/server-${mode}.log 2>&1`]);
  const result = docker(["exec", "-w", "/opt", ...envArgs, smokeContainer, "node", "--no-warnings", "/opt/pkg-tools/smoke.mjs", mode, ip, ...(priorIp ? [priorIp] : [])], { allowFail: true });
  docker(["exec", smokeContainer, "sh", "-c", "pid=$(cat /tmp/server.pid); kill -TERM $pid 2>/dev/null; for i in $(seq 1 50); do kill -0 $pid 2>/dev/null || exit 0; sleep 0.2; done; kill -KILL $pid"], { allowFail: true });
  const serverLog = docker(["exec", smokeContainer, "cat", `/tmp/server-${mode}.log`], { allowFail: true }).stdout;
  console.log(`--- server log (${mode}) ---\n${serverLog.trim()}\n---`);
  if (result.status !== 0) fail(`smoke test (${mode}) crashed:\n${result.stderr}`);
  return { ...JSON.parse(result.stdout), serverLog };
}

function checkSmoke(result, { firstRun }) {
  const problems = [];
  const expect = (label, actual, expected) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? "PASS" : "FAIL"}  [${result.mode}] ${label}: ${JSON.stringify(actual)}${ok ? "" : ` (expected ${JSON.stringify(expected)})`}`);
    if (!ok) problems.push(label);
  };
  expect("server ready", result.ready, true);
  if (!result.ready) return problems;
  expect("database created in ALESYA_DATA_DIR", result.dbExists, true);
  expect("alesya_migrations rows == drizzle/*.sql", result.migrationRows, result.migrationFiles);
  expect("GET /", result.home, 200);
  for (const [header, value] of Object.entries(result.securityHeaders)) expect(`header ${header} present`, Boolean(value), true);
  for (const page of ["/catalogo", "/proyectos", "/api/products", "/admin/login"]) expect(`GET ${page}`, result[page], 200);
  expect("GET /admin status", result["/admin"].status, 307);
  expect("GET /admin redirects to /admin/login", /\/admin\/login$/.test(result["/admin"].location ?? ""), true);
  expect(`GET ${result.staticAsset.path}`, result.staticAsset.status, 200);
  expect(`GET ${result.publicAsset.path}`, result.publicAsset.status, 200);
  expect("POST /api/leads x5 then limit", result.leadStatuses, [201, 201, 201, 201, 201, 429]);
  // Next's base-server fills a missing x-forwarded-for with the socket peer address, so over
  // plain TCP a header-less request is keyed to the peer (here 127.0.0.1) instead of failing.
  // The 503 fail-safe only triggers when there is no peer address (e.g. a Unix socket, as
  // under Passenger). Report the actual status; accept either behaviour.
  console.log(`INFO  [${result.mode}] POST /api/leads without x-forwarded-for: ${result.noHeaderStatus} (${result.noHeaderStatus === 503 ? "fail-safe 503" : "keyed to TCP peer address injected by Next"})`);
  expect("POST /api/leads without IP header is 503 or peer-keyed 201", [201, 503].includes(result.noHeaderStatus), true);
  expect("POST /api/leads with invalid IP header (fail safe)", result.invalidHeaderStatus, 503);
  expect("lead rows inserted (only allowed requests)", result.leadRowsAfter - result.leadRowsBefore, 5 + (result.noHeaderStatus === 201 ? 1 : 0));
  if (!firstRun) expect("previous IP still limited after restart (persistent limiter)", result.priorIpStatus, 429);
  if (/\b(Error|ERR_[A-Z_]+|Unhandled)\b/.test(result.serverLog.replace(/trusted_proxy_ip_header_missing[^\n]*/g, ""))) {
    console.log(`FAIL  [${result.mode}] server log contains errors`);
    problems.push("server log errors");
  }
  return problems;
}

async function main() {
  console.log(`Alesya cPanel packager — image ${IMAGE} (${DOCKER_PLATFORM}), run ${runId}`);
  const info = docker(["info", "--format", "{{.ServerVersion}} {{.OSType}}/{{.Architecture}}"], { allowFail: true });
  if (info.status !== 0) fail(`Docker daemon is not reachable. Start Docker Desktop and retry.\n${info.stderr.trim()}`);
  console.log(`Docker ${info.stdout.trim()}`);
  if (docker(["image", "inspect", "--format", "{{.Architecture}}", IMAGE], { allowFail: true }).stdout.trim() !== "amd64") {
    log(`pulling ${IMAGE} for ${DOCKER_PLATFORM}`);
    docker(["pull", "--platform", DOCKER_PLATFORM, IMAGE], { inherit: true });
  }

  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "alesya-pkg-"));
  try {
    log("staging sources (without node_modules, .next, .env*, .local, .demo, outputs …)");
    const staged = await stageSources(stagingRoot);

    log(`build container ${buildContainer}`);
    startContainer(buildContainer);
    docker(["cp", staged.source, `${buildContainer}:/opt/`]);
    docker(["cp", staged.tools, `${buildContainer}:/opt/`]);
    const leaked = docker(["exec", buildContainer, "sh", "-c", `cd ${BUILD_ROOT} && find . \\( -name node_modules -o -name .next -o -name '.env*' ! -name .env.example -o -name .local -o -name .demo \\) -print | head`]).stdout.trim();
    if (leaked) fail(`excluded paths reached the build context:\n${leaked}`);

    log("npm ci && npm run build (inside linux/amd64)");
    docker(["exec", "-w", BUILD_ROOT, "-e", "CI=1", buildContainer, "sh", "-c", "unset DEMO_DATABASE; node -v && npm -v && npm ci && npm run build"], { inherit: true });

    log("assembling package");
    docker(["exec", buildContainer, "sh", "/opt/pkg-tools/assemble.sh"], { inherit: true });
    await mkdir(outDir, { recursive: true });
    await rm(partialArchive, { force: true });
    docker(["cp", `${buildContainer}:/opt/out/package.tar.gz`, partialArchive]);
    const containerHash = docker(["exec", buildContainer, "sh", "-c", "sha256sum /opt/out/package.tar.gz | cut -d' ' -f1"]).stdout.trim();
    const sha256 = await sha256File(partialArchive);
    if (sha256 !== containerHash) fail(`archive changed while copying to the host (${containerHash} != ${sha256})`);
    if (!keepContainers) { docker(["rm", "-f", buildContainer], { allowFail: true }); containers.splice(containers.indexOf(buildContainer), 1); }

    log(`validating the exact archive in a fresh container ${smokeContainer}`);
    startContainer(smokeContainer);
    docker(["cp", partialArchive, `${smokeContainer}:/tmp/package.tar.gz`]);
    docker(["cp", staged.tools, `${smokeContainer}:/opt/`]);
    const hostPaths = [...new Set([platformDir, gitRoot, platformDir.split(path.sep).join("/"), os.homedir()].filter((p) => p.length > 8))];
    const secrets = readEnvSecrets(path.join(platformDir, ".env.local"));
    const verifyRun = docker(["exec", "-i", smokeContainer, "node", "/opt/pkg-tools/verify.mjs"], {
      input: JSON.stringify({ archive: "/tmp/package.tar.gz", root: "/opt/alesya-verify", buildRoot: BUILD_ROOT, hostPaths, secrets }),
      allowFail: true,
    });
    if (verifyRun.status !== 0) fail(`validator crashed:\n${verifyRun.stderr}`);
    const report = JSON.parse(verifyRun.stdout);
    console.log(JSON.stringify({ ...report, secretValuesScanned: report.secretValuesScanned, errors: undefined }, null, 2));
    if (!existsSync(path.join(platformDir, ".env.local"))) console.log("WARNING: platform/.env.local not found; secret scan had no values to look for.");
    if (report.errors.length) fail(`validation failed:\n - ${report.errors.join("\n - ")}`);
    console.log(`PASS  validation (${report.entries} entries, ${report.nativeModules.length} native modules ELF x86-64, ${report.secretValuesScanned} secret values scanned, ${report.secretMatches} matches)`);

    if (runSmoke) {
      log("smoke test");
      docker(["exec", smokeContainer, "sh", "-c", "mkdir -p /home/app && tar -xzf /tmp/package.tar.gz -C /home/app && rm -rf /tmp/data"]);
      const salt = randomBytes(16).toString("hex");
      const env = {
        NODE_ENV: "production",
        TRUSTED_PROXY_IP_HEADER: "x-forwarded-for",
        ALESYA_DATA_DIR: "/tmp/data",
        ADMIN_EMAIL: "test@example.com",
        ADMIN_PASSWORD_HASH: `${salt}:${scryptSync(randomBytes(24).toString("base64url"), salt, 64).toString("hex")}`,
        ADMIN_SESSION_SECRET: randomBytes(48).toString("base64url"),
        PORT: "3000",
        HOSTNAME: "127.0.0.1",
      };
      const first = smokeRun("server", "203.0.113.7", null, env);
      const second = smokeRun("require", "203.0.113.8", "203.0.113.7", env);
      const problems = [...checkSmoke(first, { firstRun: true }), ...checkSmoke(second, { firstRun: false })];
      if (problems.length) fail(`smoke test failed: ${problems.join("; ")}`);
      console.log("PASS  smoke test (node server.js, then require('./server.js') against the same data dir)");
    } else {
      console.log("SKIPPED smoke test (--no-smoke)");
    }

    await rm(finalArchive, { force: true });
    await rename(partialArchive, finalArchive);
    await writeFile(`${finalArchive.slice(0, -".tar.gz".length)}.sha256`, `${sha256}  ${path.basename(finalArchive)}\n`);
    const { size } = await stat(finalArchive);
    log("done");
    console.log(`Package: ${finalArchive}`);
    console.log(`SHA-256: ${sha256}`);
    console.log(`Size:    ${size} bytes (${(size / 1024 / 1024).toFixed(1)} MiB)`);
  } finally {
    if (!keepContainers) for (const name of containers) docker(["rm", "-f", name], { allowFail: true });
    else if (containers.length) console.log(`Kept containers: ${containers.join(", ")}`);
    await rm(stagingRoot, { recursive: true, force: true });
    await rm(partialArchive, { force: true }).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(`\n[package-cpanel] FAILED: ${error.packaging ? error.message : error.stack}`);
  process.exitCode = 1;
});
