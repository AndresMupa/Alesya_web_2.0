import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { securityLog } from "@/lib/security-log";

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Los trabajos de cron de cPanel llaman a /api/cron/* con el secreto `CRON_SECRET` (al menos 16 caracteres). Se prefiere la cabecera
 * `Authorization: Bearer <secreto>`, que no queda en los registros de acceso del servidor; `?token=` sigue funcionando para los
 * cron ya configurados. Un intento sin secreto válido queda en el registro de seguridad.
 */
export function cronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const bearer = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  const token = bearer ?? new URL(request.url).searchParams.get("token");
  const authorized = Boolean(secret && token && secret.length >= 16 && timingSafeEqual(digest(secret), digest(token)));
  if (!authorized) securityLog("cron_unauthorized", request, { path: new URL(request.url).pathname });
  return authorized;
}
