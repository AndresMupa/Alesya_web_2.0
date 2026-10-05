// Pruebas del despliegue por API contra un cPanel simulado (node --test .github/scripts/cpanel-deploy.test.mjs).
// El simulador responde como la documentación de UAPI Fileman y API 2 Fileman::fileop y permite provocar fallos.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "cpanel-deploy.mjs");
const USER = "alesyaed";
const TOKEN = "TESTTOKEN123";
const HOME = `/home/${USER}`;
const APP_DIR = `${HOME}/alesya-platform`;
const COMMIT = "abcdef1234567890";

const run = (command, args, options) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  child.on("error", reject);
  child.on("close", (code) => resolve({ code, output }));
});

/** cPanel simulado: rutas remotas /home/<usuario>/… viven bajo `root`. */
function mockCpanel(root, faults) {
  const local = (remote) => path.join(root, (remote.startsWith("/") ? remote : `${HOME}/${remote}`).replace(/^\/+/, ""));
  const uapiReply = (res, data, errors) => res.end(JSON.stringify({ status: errors ? 0 : 1, errors: errors ?? null, messages: null, warnings: null, metadata: {}, data: data ?? null }));
  const api2Reply = (res, item) => res.end(JSON.stringify({ cpanelresult: { apiversion: 2, func: "fileop", module: "Fileman", data: [item], event: { result: 1 } } }));

  return http.createServer(async (req, res) => {
    if (faults.blocked) { res.writeHead(403, { "content-type": "text/html" }); return res.end("<html><body>Access denied by Imunify360</body></html>"); }
    if (req.headers.authorization !== `cpanel ${USER}:${TOKEN}`) { res.writeHead(401, { "content-type": "text/html" }); return res.end("<html>Unauthorized</html>"); }
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const url = new URL(req.url, "http://mock");
    res.setHeader("content-type", "application/json");
    const form = req.headers["content-type"]?.startsWith("multipart/")
      ? await new Response(body, { headers: { "content-type": req.headers["content-type"] } }).formData()
      : new URLSearchParams(body.toString());

    if (url.pathname === "/execute/Fileman/upload_files") {
      const dir = local(String(form.get("dir") ?? HOME));
      await mkdir(dir, { recursive: true });
      const uploads = [];
      for (const [field, value] of form.entries()) {
        if (!field.startsWith("file-") || typeof value === "string") continue;
        const target = path.join(dir, value.name);
        if (existsSync(target) && form.get("overwrite") !== "1") { uploads.push({ file: value.name, status: 0, reason: "already exists", size: value.size }); continue; }
        await writeFile(target, Buffer.from(await value.arrayBuffer()));
        uploads.push({ file: value.name, status: 1, reason: `Upload of “${value.name}” succeeded.`, size: value.size, warnings: [] });
      }
      if (!uploads.length) return uapiReply(res, null, ["You must specify at least one file to upload."]);
      const failed = uploads.filter((item) => item.status === 0).length;
      return uapiReply(res, { uploads, succeeded: uploads.length - failed, failed, warned: 0, diskinfo: { file_upload_max_bytes: "104857600.00" } });
    }
    if (url.pathname === "/execute/Fileman/list_files") {
      const dir = local(form.get("dir"));
      if (!existsSync(dir)) return uapiReply(res, null, ["No existe el directorio."]);
      const only = form.get("only_these_files")?.split(",");
      const names = (await readdir(dir, { withFileTypes: true })).filter((entry) => !only || only.includes(entry.name));
      const entries = names.map((entry) => ({ file: entry.name, type: entry.isDirectory() ? "dir" : "file", exists: 1, fullpath: `${form.get("dir")}/${entry.name}` }));
      return uapiReply(res, faults.objectListing ? { dirs: entries.filter((e) => e.type === "dir"), files: entries.filter((e) => e.type === "file") } : entries);
    }
    if (url.pathname === "/execute/Fileman/get_file_content") {
      const file = path.join(local(form.get("dir")), form.get("file"));
      if (!existsSync(file)) return uapiReply(res, null, ["No existe el archivo o el directorio."]);
      return uapiReply(res, { content: await readFile(file, "utf8"), dir: form.get("dir"), filename: form.get("file") });
    }
    if (url.pathname === "/execute/Fileman/get_file_information") {
      if (!existsSync(local(form.get("path")))) return uapiReply(res, null, ["No existe el archivo o el directorio."]);
      return uapiReply(res, { exists: 1, path: form.get("path") });
    }
    if (url.pathname === "/json-api/cpanel" && form.get("cpanel_jsonapi_func") === "fileop") {
      const op = form.get("op"); const source = form.get("sourcefiles"); const destination = form.get("destfiles");
      const src = local(source);
      if (!existsSync(src)) return api2Reply(res, { result: 0, err: "No existe el archivo." });
      if (op === "extract") {
        const dest = local(destination);
        const { code } = await run("tar", ["-xzf", path.relative(dest, src)], { cwd: dest });
        if (code !== 0) return api2Reply(res, { result: 0, err: "tar falló" });
        if (faults.truncateExtract) await rm(path.join(dest, ".next", "BUILD_ID"), { force: true });
        return api2Reply(res, { result: 1, src: source, dest: destination });
      }
      if (op === "rename") {
        if (faults.failReleaseRename && source.includes(".release-")) return api2Reply(res, { result: 0, err: "Permiso denegado." });
        // Semántica distinta a la esperada: el destino se toma como un nombre dentro de public_html.
        const target = faults.renameIntoPublicHtml ? local(`${HOME}/public_html/${path.posix.basename(destination)}`) : local(destination);
        if (existsSync(target)) return api2Reply(res, { result: 0, err: "El destino ya existe." });
        await mkdir(path.dirname(target), { recursive: true });
        await rename(src, target);
        return api2Reply(res, { result: 1, src: source, dest: faults.renameIntoPublicHtml ? `${HOME}/public_html/${path.posix.basename(destination)}` : destination });
      }
      if (op === "unlink") {
        if (faults.unlinkKeepsDirs) return api2Reply(res, { result: 1, src: source });
        await rm(src, { recursive: true, force: true });
        return api2Reply(res, { result: 1, src: source });
      }
      if (op === "trash") {
        const trash = local(`${HOME}/.trash`); await mkdir(trash, { recursive: true });
        await rename(src, path.join(trash, `${path.basename(src)}-${Date.now()}`));
        return api2Reply(res, { result: 1, src: source });
      }
      return api2Reply(res, { result: 0, err: `op ${op} no simulada` });
    }
    res.statusCode = 404; res.end(JSON.stringify({ status: 0, errors: ["Función desconocida"] }));
  });
}

describe("despliegue por API de cPanel", () => {
  let workdir, root, server, url, archive, pkg;
  const faults = {};
  const remote = (relative) => path.join(root, HOME.slice(1), relative);
  const buildOf = async (dir) => (await readFile(path.join(remote(dir), ".next", "BUILD_ID"), "utf8")).trim();
  // SHOW_DEPLOY_OUTPUT=1 imprime lo que mostraría el registro de GitHub Actions.
  const deploy = async (mode = "deploy", extra = {}) => {
    const result = await run(process.execPath, [SCRIPT, mode], {
      env: { ...process.env, API_URL: url, API_TOKEN: TOKEN, CPANEL_USER: USER, APP_DIR, COMMIT, ARCHIVE: archive, PKG_DIR: pkg, GITHUB_OUTPUT: path.join(workdir, "output.txt"), ...extra },
    });
    if (process.env.SHOW_DEPLOY_OUTPUT) console.log(result.output);
    return result;
  };

  before(async () => {
    workdir = await mkdtemp(path.join(os.tmpdir(), "cpanel-deploy-"));
    pkg = path.join(workdir, "pkg");
    await mkdir(path.join(pkg, ".next"), { recursive: true });
    await mkdir(path.join(pkg, "node_modules", "dep"), { recursive: true });
    await writeFile(path.join(pkg, ".next", "BUILD_ID"), "NEWBUILD");
    await writeFile(path.join(pkg, "server.js"), "// servidor nuevo\n");
    await writeFile(path.join(pkg, "node_modules", "dep", "index.js"), "module.exports = 1;\n");
    // BIG_PACKAGE_MB=25 simula el tamaño real del paquete (~21 MB) con datos que no se comprimen.
    if (process.env.BIG_PACKAGE_MB) await writeFile(path.join(pkg, "node_modules", "dep", "big.bin"), randomBytes(Number(process.env.BIG_PACKAGE_MB) * 1048576));
    archive = path.join(workdir, "alesya-cpanel.tar.gz");
    const packed = await run("tar", ["-czf", "alesya-cpanel.tar.gz", "-C", "pkg", "."], { cwd: workdir });
    assert.equal(packed.code, 0, packed.output);
    server = mockCpanel(path.join(workdir, "server"), faults);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    url = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => { server?.close(); await rm(workdir, { recursive: true, force: true }); });

  beforeEach(async () => {
    for (const key of Object.keys(faults)) delete faults[key];
    root = path.join(workdir, "server");
    await rm(root, { recursive: true, force: true });
    await mkdir(path.join(remote("alesya-platform"), ".next"), { recursive: true });
    await mkdir(path.join(remote("alesya-platform"), "tmp"), { recursive: true });
    await writeFile(path.join(remote("alesya-platform"), ".next", "BUILD_ID"), "OLDBUILD");
    await writeFile(path.join(remote("alesya-platform"), "server.js"), "// servidor anterior\n");
    await writeFile(path.join(remote("alesya-platform"), "tmp", "restart.txt"), "antes\n");
    await mkdir(path.join(remote("alesya-platform.previous"), ".next"), { recursive: true });
    await writeFile(path.join(remote("alesya-platform.previous"), ".next", "BUILD_ID"), "OLDERBUILD");
    await mkdir(remote("alesya-platform.release-0123456789ab"), { recursive: true }); // resto de un intento fallido
    await mkdir(remote("public_html"), { recursive: true });
    await rm(path.join(workdir, "output.txt"), { force: true });
  });

  const assertUntouched = async () => {
    assert.equal(await buildOf("alesya-platform"), "OLDBUILD");
    assert.equal(await readFile(path.join(remote("alesya-platform"), "tmp", "restart.txt"), "utf8"), "antes\n");
  };

  test("activa la versión nueva, guarda la anterior, limpia restos y reinicia", async () => {
    const { code, output } = await deploy();
    assert.equal(code, 0, output);
    assert.equal(await buildOf("alesya-platform"), "NEWBUILD");
    assert.equal(await buildOf("alesya-platform.previous"), "OLDBUILD");
    assert.match(await readFile(path.join(remote("alesya-platform"), "tmp", "restart.txt"), "utf8"), /abcdef123456/);
    const home = await readdir(remote(""));
    assert.deepEqual(home.sort(), ["alesya-platform", "alesya-platform.previous", "public_html"]);
    assert.ok(!existsSync(path.join(remote("alesya-platform"), "alesya-deploy-abcdef123456.tar.gz")), "el paquete subido no queda dentro de la app");
    assert.match(await readFile(path.join(workdir, "output.txt"), "utf8"), /swapped=true/);
  });

  test("también entiende list_files con forma {dirs, files}", async () => {
    faults.objectListing = true;
    const { code, output } = await deploy();
    assert.equal(code, 0, output);
    assert.equal(await buildOf("alesya-platform"), "NEWBUILD");
  });

  test("si el firewall bloquea la API no toca nada", async () => {
    faults.blocked = true;
    const { code, output } = await deploy();
    assert.equal(code, 1);
    assert.match(output, /no es JSON/);
    await assertUntouched();
  });

  test("con un token inválido no toca nada", async () => {
    const { code, output } = await deploy("deploy", { API_TOKEN: "otro" });
    assert.equal(code, 1);
    assert.match(output, /HTTP 401/);
    await assertUntouched();
  });

  test("si renombrar se comporta distinto, la autoprueba lo detecta antes de tocar la app", async () => {
    faults.renameIntoPublicHtml = true;
    const { code, output } = await deploy();
    assert.equal(code, 1);
    assert.match(output, /Renombrar no se comportó/);
    await assertUntouched();
    assert.ok(!existsSync(remote("alesya-platform.release-abcdef123456")), "no llegó a subir el paquete");
  });

  test("si la extracción queda incompleta no toca la app", async () => {
    faults.truncateExtract = true;
    const { code, output } = await deploy();
    assert.equal(code, 1);
    assert.match(output, /extracción no quedó completa/);
    await assertUntouched();
    assert.equal(await buildOf("alesya-platform.previous"), "OLDERBUILD");
  });

  test("si no puede activar la versión nueva restaura la anterior", async () => {
    faults.failReleaseRename = true;
    const { code, output } = await deploy();
    assert.equal(code, 1);
    assert.match(output, /quedó con la versión anterior/);
    assert.equal(await buildOf("alesya-platform"), "OLDBUILD");
    assert.match(await readFile(path.join(remote("alesya-platform"), "tmp", "restart.txt"), "utf8"), /abcdef123456/, "reinicia la app restaurada");
    assert.ok(!existsSync(path.join(workdir, "output.txt")) || !(await readFile(path.join(workdir, "output.txt"), "utf8")).includes("swapped=true"));
  });

  test("si unlink no borra carpetas usa la papelera", async () => {
    faults.unlinkKeepsDirs = true;
    const { code, output } = await deploy();
    assert.equal(code, 0, output);
    assert.equal(await buildOf("alesya-platform"), "NEWBUILD");
    assert.match(output, /papelera/);
  });

  test("rollback vuelve a la versión anterior y guarda la fallida", async () => {
    assert.equal((await deploy()).code, 0);
    const { code, output } = await deploy("rollback");
    assert.equal(code, 0, output);
    assert.equal(await buildOf("alesya-platform"), "OLDBUILD");
    assert.equal(await buildOf("alesya-platform.failed-abcdef123456"), "NEWBUILD");
    assert.ok(!existsSync(remote("alesya-platform.previous")));
    assert.match(await readFile(path.join(remote("alesya-platform"), "tmp", "restart.txt"), "utf8"), /abcdef123456/);
  });

  test("rechaza una carpeta de app fuera del home", async () => {
    const { code, output } = await deploy("deploy", { APP_DIR: "/etc/passwd" });
    assert.equal(code, 1);
    assert.match(output, /CPANEL_APP_DIR inválido/);
  });
});
