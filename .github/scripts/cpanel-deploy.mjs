#!/usr/bin/env node
// Despliegue a cPanel solo por HTTPS con la API de cPanel (sin SFTP ni SSH).
//
//   node .github/scripts/cpanel-deploy.mjs deploy     sube, extrae, verifica y activa la versión nueva
//   node .github/scripts/cpanel-deploy.mjs rollback   vuelve a la versión anterior (tras un chequeo de salud fallido)
//
// Variables: API_URL (https://dominio:2083), API_TOKEN, CPANEL_USER, APP_DIR (/home/<usuario>/<carpeta>), COMMIT y,
// para deploy, ARCHIVE (el .tar.gz de package:cpanel) y PKG_DIR (ese paquete extraído, para leer su BUILD_ID).
//
// Usa solo funciones disponibles desde cPanel 11.44 —UAPI Fileman::upload_files, list_files, get_file_content y
// get_file_information, Quota::get_quota_info y API 2 Fileman::fileop (extract, rename, unlink, trash)— porque
// rename_file, move_file y delete_file solo existen desde cPanel 136. Cada paso se comprueba leyendo el estado real del servidor; la app solo
// se toca cuando la versión nueva está completa y verificada, y si algo falla al activarla se restaura la anterior.
import { appendFile, readFile, readdir, stat } from "node:fs/promises";
import { openAsBlob } from "node:fs";
import path from "node:path";

class DeployError extends Error {}
const fail = (message) => { throw new DeployError(message); };
const log = (message) => console.log(message);
const warn = (message) => console.log(`::warning::${message}`);
const step = (message) => console.log(`\n▶ ${message}`);
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Configuración desde el entorno. Se lee dentro del flujo principal para que un faltante se informe como error claro. */
let API_URL, USER, AUTHORIZATION, APP_DIR, HOME, APP, COMMIT, PREVIOUS, RELEASE, FAILED, PROBE, PROBE_OK, LEFTOVER;
function loadConfig() {
  const env = (name) => { const value = process.env[name]?.trim(); if (!value) fail(`Falta la variable ${name}.`); return value; };
  API_URL = env("API_URL").replace(/\/+$/, "");
  USER = env("CPANEL_USER");
  AUTHORIZATION = `cpanel ${USER}:${env("API_TOKEN")}`;
  APP_DIR = env("APP_DIR");
  // Protege las operaciones remotas: solo carpetas directas del home de la cuenta.
  if (!/^\/home\d*\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/.test(APP_DIR)) fail("CPANEL_APP_DIR inválido: debe ser /home/<usuario>/<carpeta>.");
  HOME = path.posix.dirname(APP_DIR);
  APP = path.posix.basename(APP_DIR);
  COMMIT = env("COMMIT").slice(0, 12);
  if (!/^[0-9a-f]{7,12}$/.test(COMMIT)) fail("COMMIT inválido.");
  PREVIOUS = `${APP}.previous`;
  RELEASE = `${APP}.release-${COMMIT}`;
  FAILED = `${APP}.failed-${COMMIT}`;
  PROBE = `alesya-deploy-probe-${COMMIT}`;
  PROBE_OK = `${PROBE}-ok`;
  // Restos de despliegues anteriores que se pueden borrar sin riesgo (nunca la app ni la versión anterior).
  const sha = "[0-9a-f]{7,12}";
  LEFTOVER = new RegExp(`^(${escapeRegExp(APP)}\\.(release|failed)-${sha}|alesya-deploy-probe-${sha}(-ok)?|alesya-deploy-${sha}\\.tar\\.gz)$`);
  return { env };
}
const abs = (name) => `${HOME}/${name}`;

// ── API ──────────────────────────────────────────────────────────────────────

async function post(url, body, timeoutMs) {
  const where = new URL(url).pathname;
  let response;
  try { response = await fetch(url, { method: "POST", headers: { authorization: AUTHORIZATION }, body, signal: AbortSignal.timeout(timeoutMs) }); }
  catch (error) { fail(`Sin respuesta de ${where} (${error.cause?.code ?? error.name}). ¿El firewall del hosting bloquea a GitHub?`); }
  const text = await response.text();
  try { return { status: response.status, json: JSON.parse(text) }; }
  catch { fail(`HTTP ${response.status} en ${where} con una respuesta que no es JSON (¿token inválido o bloqueo de Imunify360?): ${text.replace(/\s+/g, " ").slice(0, 200)}`); }
}

/**
 * UAPI <module>::<func> (Fileman por defecto). Devuelve `data`; falla si cPanel no confirma la operación. En una subida
 * rechazada el motivo de cada archivo viene en `data.uploads[].reason` (los `errors` solo dicen "various failures").
 */
async function uapi(func, params, { body, timeoutMs = 120_000, module = "Fileman" } = {}) {
  const { status, json } = await post(`${API_URL}/execute/${module}/${func}`, body ?? new URLSearchParams(params), timeoutMs);
  const result = json?.result ?? json;
  if (result?.status !== 1) {
    const reasons = (result?.data?.uploads ?? []).map((item) => item?.reason).filter(Boolean);
    fail(`${module}::${func} falló (HTTP ${status}): ${JSON.stringify(result?.errors ?? result?.data ?? result).slice(0, 300)}${reasons.length ? ` Motivo: ${reasons.join("; ").slice(0, 300)}` : ""}`);
  }
  return result.data;
}

/** API 2 Fileman::fileop. Devuelve el resultado de la operación; falla si cPanel no la confirma. */
async function fileop(op, source, destination) {
  const params = new URLSearchParams({ cpanel_jsonapi_user: USER, cpanel_jsonapi_apiversion: "2", cpanel_jsonapi_module: "Fileman", cpanel_jsonapi_func: "fileop", op, sourcefiles: source, doubledecode: "0" });
  if (destination) params.set("destfiles", destination);
  const { status, json } = await post(`${API_URL}/json-api/cpanel`, params, 15 * 60_000);
  const result = json?.cpanelresult;
  const item = result?.data?.[0];
  if (!result || result.error || item?.result !== 1) fail(`fileop ${op} falló (HTTP ${status}): ${JSON.stringify(result?.error ?? item?.err ?? item ?? json).slice(0, 300)}`);
  return item;
}

/** Nombres que existen en el home. Se lee la carpeta en vez de interpretar mensajes de error, que dependen del idioma de la cuenta. */
async function listHome(only) {
  const params = { dir: HOME, show_hidden: "1" };
  if (only) params.only_these_files = only.join(",");
  const data = await uapi("list_files", params);
  const entries = Array.isArray(data) ? data : [...(data?.dirs ?? []), ...(data?.files ?? [])];
  const names = new Set(entries.filter((entry) => entry && entry.exists !== 0).map((entry) => entry.file));
  return only ? new Set(only.filter((name) => names.has(name))) : names;
}

async function readText(dir, file) {
  const data = await uapi("get_file_content", { dir, file, from_charset: "UTF-8", to_charset: "UTF-8" });
  return String(data?.content ?? "").trim();
}

async function assertExists(fullPath) {
  const data = await uapi("get_file_information", { path: fullPath, show_hidden: "1" });
  if (data && data.exists === 0) fail(`No existe ${fullPath}.`);
}

/** Cuota de la cuenta (UAPI Quota::get_quota_info). `null` si el hosting no la informa o no tiene límite. */
async function diskSpace() {
  let data;
  try { data = await uapi("get_quota_info", {}, { module: "Quota" }); } catch (error) { log(`No se pudo leer la cuota de disco (${error.message}).`); return null; }
  const number = (value) => (value === undefined || value === null || value === "" ? NaN : Number(value));
  const usedMb = number(data?.megabytes_used), limitMb = number(data?.megabyte_limit);
  const inodesUsed = number(data?.inodes_used), inodeLimit = number(data?.inode_limit);
  const space = {
    mb: Number.isFinite(usedMb) && limitMb > 0 ? { used: usedMb, limit: limitMb, free: limitMb - usedMb } : null,
    inodes: Number.isFinite(inodesUsed) && inodeLimit > 0 ? { used: inodesUsed, limit: inodeLimit, free: inodeLimit - inodesUsed } : null,
  };
  return space.mb || space.inodes ? space : null;
}

/** Tamaño y número de archivos del paquete extraído: lo que ocupará la versión nueva en el servidor. */
async function folderSize(dir) {
  let bytes = 0, files = 0;
  for (const entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
    files += 1;
    if (entry.isFile()) bytes += (await stat(path.join(entry.parentPath ?? entry.path, entry.name))).size;
  }
  return { bytes, files };
}

const shortOf = (space, need) => [
  space?.mb && space.mb.free < need.mb ? `libres ${space.mb.free.toFixed(0)} MB y se necesitan unos ${need.mb.toFixed(0)} MB` : "",
  space?.inodes && space.inodes.free < need.inodes ? `quedan ${space.inodes.free} archivos de cupo y se necesitan unos ${need.inodes}` : "",
].filter(Boolean).join("; ");

async function upload(dir, source, filename) {
  const form = new FormData();
  form.set("dir", dir);
  form.set("overwrite", "1");
  form.set("get_disk_info", "1");
  form.set("file-0", typeof source === "string" ? await openAsBlob(source) : new Blob([source]), filename);
  const data = await uapi("upload_files", null, { body: form, timeoutMs: 20 * 60_000 });
  const item = data?.uploads?.find((entry) => entry.file === filename) ?? data?.uploads?.[0];
  if (Number(data?.failed) > 0 || Number(data?.succeeded) < 1 || item?.status === 0) {
    const limit = data?.diskinfo?.file_upload_max_bytes ? ` Límite de subida del hosting: ${Math.round(Number(data.diskinfo.file_upload_max_bytes) / 1048576)} MB.` : "";
    fail(`La subida de ${filename} falló: ${item?.reason ?? JSON.stringify(data).slice(0, 300)}.${limit}`);
  }
  for (const message of item?.warnings ?? []) warn(`${filename}: ${message}`);
}

/** Borra algo del home y comprueba que ya no está. Si `unlink` no lo quita, lo manda a la papelera de cPanel. */
async function remove(name) {
  try { await fileop("unlink", abs(name)); } catch (error) { warn(error.message); }
  if (!(await listHome([name])).has(name)) return;
  warn(`unlink no borró ${name}; se envía a la papelera de cPanel (vacíala en el Administrador de archivos para liberar espacio).`);
  try { await fileop("trash", abs(name)); } catch (error) { warn(error.message); }
  if ((await listHome([name])).has(name)) fail(`No se pudo quitar ${abs(name)}.`);
}

/** Renombra dentro del home y comprueba el resultado leyendo la carpeta: no basta con la respuesta de la API. */
async function renameChecked(from, to) {
  let reported = "";
  try { reported = (await fileop("rename", abs(from), abs(to)))?.dest ?? ""; } catch (error) { warn(error.message); }
  const state = await listHome([from, to]);
  return { moved: state.has(to) && !state.has(from), unchanged: state.has(from) && !state.has(to), reported };
}

/** Passenger reinicia la app cuando cambia la fecha de tmp/restart.txt. */
async function touchRestart() {
  await upload(`${APP_DIR}/tmp`, Buffer.from(`${new Date().toISOString()} ${COMMIT}\n`), "restart.txt");
}

const setOutput = (name, value) => (process.env.GITHUB_OUTPUT ? appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`) : Promise.resolve());

// ── Pasos ────────────────────────────────────────────────────────────────────

/** Comprueba con una carpeta temporal que subir, renombrar con rutas completas, leer y borrar funcionan como se espera. */
async function selfTest() {
  await upload(abs(PROBE), Buffer.from("ok\n"), "probe.txt");
  if (!(await listHome([PROBE])).has(PROBE)) fail("La subida no creó la carpeta de prueba. No se tocó la app.");
  const { moved, reported } = await renameChecked(PROBE, PROBE_OK);
  if (!moved) {
    for (const name of [PROBE, PROBE_OK]) if ((await listHome([name])).has(name)) await remove(name).catch((error) => warn(error.message));
    fail(`Renombrar no se comportó como se esperaba (cPanel informó destino "${reported}"). No se tocó la app.`);
  }
  if ((await readText(abs(PROBE_OK), "probe.txt")) !== "ok") fail("La carpeta de prueba no conservó su contenido al renombrarla. No se tocó la app.");
  await remove(PROBE_OK);
}

async function deploy({ env }) {
  const archive = env("ARCHIVE");
  const buildId = (await readFile(path.join(env("PKG_DIR"), ".next", "BUILD_ID"), "utf8")).trim();
  const archiveName = `alesya-deploy-${COMMIT}.tar.gz`;

  step("1/8 Acceso a la API de cPanel");
  const home = await listHome();
  if (!home.has(APP)) fail(`No existe ${APP_DIR}: revisa CPANEL_APP_DIR.`);
  log(`API OK. Versión activa en ${APP_DIR}${home.has(PREVIOUS) ? `; versión anterior guardada en ${PREVIOUS}` : ""}.`);
  for (const name of [...home].filter((entry) => LEFTOVER.test(entry))) { log(`Quitando restos de un despliegue anterior: ${name}`); await remove(name); }

  step("2/8 Autoprueba de subir, renombrar, leer y borrar (sin tocar la app)");
  await selfTest();
  log("Autoprueba OK.");

  // Durante el despliegue conviven la app, la versión anterior, el paquete subido y la versión nueva extraída.
  step("3/8 Espacio en el hosting");
  const archiveBytes = (await stat(archive)).size;
  const unpacked = await folderSize(env("PKG_DIR"));
  const need = { mb: ((archiveBytes + unpacked.bytes) / 1048576) * 1.1 + 5, inodes: Math.ceil(unpacked.files * 1.1) + 50 };
  let space = await diskSpace();
  if (!space) log("El hosting no informa límite de cuota; se continúa.");
  else {
    if (space.mb) log(`Disco: ${space.mb.used.toFixed(0)} de ${space.mb.limit.toFixed(0)} MB usados (libres ${space.mb.free.toFixed(0)} MB). El despliegue necesita unos ${need.mb.toFixed(0)} MB.`);
    if (space.inodes) log(`Archivos: ${space.inodes.used} de ${space.inodes.limit} (quedan ${space.inodes.free}). El despliegue necesita unos ${need.inodes}.`);
    // La versión de hace dos despliegues se borra en el paso 5 de todos modos; si falta espacio se borra antes.
    if (shortOf(space, need) && (await listHome([PREVIOUS])).has(PREVIOUS)) {
      log(`No alcanza: se borra ya ${PREVIOUS} (la versión de hace dos despliegues). La app activa no se toca.`);
      await remove(PREVIOUS);
      space = (await diskSpace()) ?? space;
    }
    const short = shortOf(space, need);
    if (short) fail(`Espacio insuficiente en el hosting: ${short}. No se tocó la app. Libera espacio en cPanel (copias de seguridad u otros archivos grandes en el home, la papelera del Administrador de archivos, fotos o videos subidos que ya no se usan) y vuelve a ejecutar el despliegue.`);
    log("Hay espacio suficiente.");
  }

  step(`4/8 Subiendo el paquete (${(archiveBytes / 1048576).toFixed(1)} MB)`);
  await upload(abs(RELEASE), archive, archiveName);
  log(`Subido a ${abs(RELEASE)}/${archiveName}`);

  step("5/8 Extrayendo en el servidor y verificando");
  await fileop("extract", `${abs(RELEASE)}/${archiveName}`, abs(RELEASE));
  const extracted = await readText(`${abs(RELEASE)}/.next`, "BUILD_ID").catch(() => "");
  if (extracted !== buildId) fail(`La extracción no quedó completa (BUILD_ID "${extracted}", se esperaba "${buildId}"). No se tocó la app.`);
  await assertExists(`${abs(RELEASE)}/server.js`);
  try { await fileop("unlink", `${abs(RELEASE)}/${archiveName}`); } catch (error) { warn(`No se borró el paquete subido: ${error.message}`); }
  log(`Versión nueva completa (build ${buildId}).`);

  step("6/8 Liberando el lugar de la versión anterior");
  if ((await listHome([PREVIOUS])).has(PREVIOUS)) await remove(PREVIOUS);
  log("Listo.");

  step("7/8 Activando la versión nueva");
  const aside = await renameChecked(APP, PREVIOUS);
  if (!aside.moved) {
    if (aside.unchanged) fail("No se pudo apartar la versión activa; la app sigue intacta.");
    fail(`Estado inesperado al apartar la versión activa (cPanel informó "${aside.reported}"). Revisa ${HOME} en el Administrador de archivos.`);
  }
  const live = await renameChecked(RELEASE, APP);
  const liveBuild = live.moved ? await readText(`${APP_DIR}/.next`, "BUILD_ID").catch(() => "") : "";
  if (!live.moved || liveBuild !== buildId) {
    warn("No se pudo activar la versión nueva; se restaura la anterior.");
    await restorePrevious(live.moved ? RELEASE : null);
    fail("La versión nueva no se activó; la app quedó con la versión anterior.");
  }
  await setOutput("swapped", "true");
  log(`Activada. La versión anterior queda en ${abs(PREVIOUS)}.`);

  step("8/8 Reiniciando la app");
  await touchRestart();
  log(`Desplegado ${COMMIT} (build ${buildId}).`);
}

/** Pone la versión anterior en su lugar. Si `apartAs` viene, la versión que estaba activa se guarda con ese nombre. */
async function restorePrevious(apartAs) {
  if (apartAs && (await listHome([APP])).has(APP)) {
    const apart = await renameChecked(APP, apartAs);
    if (!apart.moved) fail(`No se pudo apartar la versión fallida. Restaura a mano: renombra ${APP} a otro nombre y ${PREVIOUS} a ${APP}.`);
  }
  const back = await renameChecked(PREVIOUS, APP);
  if (!back.moved) fail(`No se pudo restaurar ${PREVIOUS}. Hazlo a mano en el Administrador de archivos: renombrar ${PREVIOUS} a ${APP} y Restart en "Setup Node.js App".`);
  await touchRestart();
}

async function rollback() {
  step("Volviendo a la versión anterior");
  const state = await listHome([APP, PREVIOUS, FAILED]);
  if (!state.has(PREVIOUS)) fail(`No hay versión anterior guardada (${PREVIOUS}); revisa a mano.`);
  if (state.has(FAILED)) await remove(FAILED);
  await restorePrevious(FAILED);
  log(`Se restauró la versión anterior. La versión que falló quedó en ${abs(FAILED)} para revisarla; el próximo despliegue la borra.`);
}

try {
  const context = loadConfig();
  const mode = process.argv[2] ?? "deploy";
  if (mode === "deploy") await deploy(context);
  else if (mode === "rollback") await rollback();
  else fail(`Modo desconocido: ${mode}`);
} catch (error) {
  console.log(`::error::${error instanceof DeployError ? error.message : error?.stack ?? error}`);
  process.exitCode = 1;
}
