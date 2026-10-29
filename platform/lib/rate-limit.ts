import "server-only";
import { createHash } from "node:crypto";
import { createClient } from "@libsql/client";
import { databaseUrl } from "@/db";
import { trustedClientAddress } from "@/lib/client-ip";
import { securityLog } from "@/lib/security-log";

export { trustedClientAddress };

type Policy = {
  name: string;
  limit: number;
  windowMs: number;
  globalLimit?: number;
};

type LimitResult = { allowed: boolean; retryAfter: number; key: string };

function bucketKey(namespace: string, identity: string) {
  const digest = createHash("sha256").update(identity).digest("hex");
  return `${namespace}:${digest}`;
}

async function consume(key: string, limit: number, windowMs: number): Promise<LimitResult> {
  const now = Date.now();
  const nextReset = now + windowMs;
  const client = createClient({ url: databaseUrl(), authToken: process.env.TURSO_AUTH_TOKEN });
  try {
    const result = await client.execute({
      sql: `INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)
        ON CONFLICT(key) DO UPDATE SET
          count = CASE WHEN rate_limits.reset_at <= ? THEN 1 ELSE rate_limits.count + 1 END,
          reset_at = CASE WHEN rate_limits.reset_at <= ? THEN ? ELSE rate_limits.reset_at END
        RETURNING count, reset_at`,
      args: [key, nextReset, now, now, nextReset],
    });
    const row = result.rows[0];
    const count = Number(row?.count ?? limit + 1);
    const resetAt = Number(row?.reset_at ?? nextReset);
    if (count % 100 === 1) {
      await client.execute({ sql: "DELETE FROM rate_limits WHERE reset_at < ?", args: [now - 86_400_000] });
    }
    return { allowed: count <= limit, retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1000)), key };
  } finally {
    client.close();
  }
}

/**
 * Primero el cupo de la dirección: una dirección que ya agotó el suyo recibe 429 sin tocar el cupo global, así una sola IP no puede
 * agotar el global y dejar fuera a los demás. El global (si la política lo tiene) cuenta solo las peticiones que pasaron el cupo por
 * dirección y protege frente a ataques repartidos entre muchas direcciones.
 */
export async function enforceRateLimit(request: Request, policy: Policy) {
  try {
    const address = trustedClientAddress(request);
    if (!address) {
      console.error("trusted_proxy_ip_header_missing", policy.name);
      return Response.json({ message: "La protección de acceso no está configurada." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    const result = await consume(bucketKey(policy.name, address), policy.limit, policy.windowMs);
    if (!result.allowed) { securityLog("rate_limited", request, { policy: policy.name, scope: "client" }); return rateLimited(result.retryAfter); }
    if (policy.globalLimit) {
      const global = await consume(`${policy.name}:global`, policy.globalLimit, policy.windowMs);
      if (!global.allowed) { securityLog("rate_limited", request, { policy: policy.name, scope: "global" }); return rateLimited(global.retryAfter); }
    }
    return null;
  } catch (error) {
    console.error("rate_limit_failed", policy.name, error);
    return Response.json({ message: "La protección de acceso no está disponible." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function clearRateLimit(request: Request, namespace: string) {
  const address = trustedClientAddress(request);
  if (!address) return;
  const client = createClient({ url: databaseUrl(), authToken: process.env.TURSO_AUTH_TOKEN });
  try {
    await client.execute({ sql: "DELETE FROM rate_limits WHERE key = ?", args: [bucketKey(namespace, address)] });
  } finally {
    client.close();
  }
}

/** `true` solo la primera vez dentro de la ventana: sirve para avisar una vez por hora y no por cada intento. */
export async function claimOnce(name: string, windowMs: number) {
  try { return (await consume(`once:${name}`, 1, windowMs)).allowed; }
  catch (error) { console.error("rate_limit_failed", name, error); return false; }
}

/** Cuenta un intento contra `key`; `false` cuando ya se superó `limit` dentro de la ventana (y, si la base falla, por seguridad). */
export async function countAttempt(key: string, limit: number, windowMs: number) {
  try { return (await consume(key, limit, windowMs)).allowed; }
  catch (error) { console.error("rate_limit_failed", error); return false; }
}

/** Marca una clave como bloqueada hasta `untilMs` (p. ej. una sesión cerrada), con la misma tabla y sin migración. */
export async function blockKey(key: string, untilMs: number) {
  const client = createClient({ url: databaseUrl(), authToken: process.env.TURSO_AUTH_TOKEN });
  try {
    await client.execute({ sql: "INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET reset_at = excluded.reset_at", args: [key, untilMs] });
  } finally {
    client.close();
  }
}

export async function isKeyBlocked(key: string) {
  const client = createClient({ url: databaseUrl(), authToken: process.env.TURSO_AUTH_TOKEN });
  try {
    const result = await client.execute({ sql: "SELECT 1 FROM rate_limits WHERE key = ? AND reset_at > ?", args: [key, Date.now()] });
    return result.rows.length > 0;
  } finally {
    client.close();
  }
}

function rateLimited(retryAfter: number) {
  return Response.json({ message: "Demasiadas solicitudes. Intenta nuevamente más tarde." }, {
    status: 429,
    headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" },
  });
}
