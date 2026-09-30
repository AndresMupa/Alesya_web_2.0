import "server-only";
import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { createClient } from "@libsql/client";
import { databaseUrl } from "@/db";

type Policy = {
  name: string;
  limit: number;
  windowMs: number;
  globalLimit?: number;
};

type LimitResult = { allowed: boolean; retryAfter: number; key: string };

const allowedHeaders = new Set(["x-forwarded-for", "x-real-ip", "cf-connecting-ip", "x-vercel-forwarded-for"]);

export function trustedClientAddress(request: Request) {
  const configured = process.env.TRUSTED_PROXY_IP_HEADER?.trim().toLowerCase();
  if (configured === "x-vercel-forwarded-for" && !process.env.VERCEL) return null;
  const header = configured && allowedHeaders.has(configured)
    ? configured
    : process.env.NODE_ENV === "production"
      ? null
      : "x-forwarded-for";
  if (!header) return null;

  const raw = request.headers.get(header);
  if (!raw) return process.env.NODE_ENV === "production" ? null : "127.0.0.1";
  if (raw.length > 512) return null;
  const parts = raw.split(",");
  if (parts.length > 10) return null;
  const candidate = header === "x-forwarded-for" ? parts.at(-1)?.trim() : raw.trim();
  return candidate && isIP(candidate) ? candidate : null;
}

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

export async function enforceRateLimit(request: Request, policy: Policy) {
  try {
    if (policy.globalLimit) {
      const global = await consume(`${policy.name}:global`, policy.globalLimit, policy.windowMs);
      if (!global.allowed) return rateLimited(global.retryAfter);
    }

    const address = trustedClientAddress(request);
    if (!address) {
      console.error("trusted_proxy_ip_header_missing", policy.name);
      return Response.json({ message: "La protección de acceso no está configurada." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    const result = await consume(bucketKey(policy.name, address), policy.limit, policy.windowMs);
    return result.allowed ? null : rateLimited(result.retryAfter);
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

function rateLimited(retryAfter: number) {
  return Response.json({ message: "Demasiadas solicitudes. Intenta nuevamente más tarde." }, {
    status: 429,
    headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" },
  });
}
