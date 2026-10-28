import "server-only";
import { isIP } from "node:net";

const allowedHeaders = new Set(["x-forwarded-for", "x-real-ip", "cf-connecting-ip", "x-vercel-forwarded-for"]);

/**
 * Dirección del cliente según la cabecera que el proxy del hosting sanea (`TRUSTED_PROXY_IP_HEADER`). En producción sin esa
 * variable no se confía en ninguna cabecera y devuelve `null`. En `x-forwarded-for` se toma la última entrada: la que agrega
 * el proxy, no la que pudo enviar el cliente.
 */
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
