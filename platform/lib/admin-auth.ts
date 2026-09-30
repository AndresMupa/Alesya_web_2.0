import "server-only";
import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const derive = promisify(scrypt);
export const ADMIN_COOKIE = "alesya_admin";
export const SESSION_SECONDS = 60 * 60 * 8;
export const adminConfigured = () => Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD_HASH && (process.env.ADMIN_SESSION_SECRET?.length ?? 0) >= 32);
const sign = (value: string) => createHmac("sha256", process.env.ADMIN_SESSION_SECRET!).update(value).digest("base64url");
const credentialVersion = () => createHash("sha256").update(process.env.ADMIN_PASSWORD_HASH!).digest("hex");

export async function verifyAdmin(email: string, password: string) {
  if (!adminConfigured() || password.length > 256) return false;
  const [salt, encoded] = process.env.ADMIN_PASSWORD_HASH!.split(":");
  if (!salt || !/^[a-f0-9]{128}$/.test(encoded ?? "")) return false;
  const actual = await derive(password, salt, 64) as Buffer;
  const matches = timingSafeEqual(actual, Buffer.from(encoded, "hex"));
  return matches && email.toLowerCase() === process.env.ADMIN_EMAIL!.toLowerCase();
}

export function makeSession() {
  const payload = Buffer.from(JSON.stringify({ email: process.env.ADMIN_EMAIL!.toLowerCase(), exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS, version: credentialVersion(), nonce: randomBytes(16).toString("hex") })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export async function getAdmin() {
  if (!adminConfigured()) return null;
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token || token.length > 2048) return null;
  try {
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra) return null;
    const expected = Buffer.from(sign(payload));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const session = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof session.exp !== "number" || session.exp <= Date.now() / 1000 || session.version !== credentialVersion() || session.email !== process.env.ADMIN_EMAIL!.toLowerCase()) return null;
    return { email: session.email as string };
  } catch { return null; }
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  // Compare against the host the browser used; `request.url` may report `localhost` for `127.0.0.1` in local servers.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  try { return !!origin && new URL(origin).host === host; } catch { return false; }
}

export async function guardAdmin(request?: Request) {
  const admin = await authorizeAdmin(request);
  return admin instanceof Response ? admin : null;
}

/**
 * Para las APIs del panel: devuelve el administrador o la respuesta de rechazo. Las escrituras pasan
 * `request` para exigir mismo origen; las lecturas GET pueden omitirlo.
 */
export async function authorizeAdmin(request?: Request): Promise<{ email: string } | Response> {
  const admin = await getAdmin();
  if (!admin) return Response.json({ message: "Inicia sesión para continuar." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (request && !sameOrigin(request)) return Response.json({ message: "Solicitud no permitida." }, { status: 403 });
  return admin;
}

/** Para las páginas del panel: redirige al acceso si no hay sesión. */
export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
