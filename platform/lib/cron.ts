import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Los trabajos de cron de cPanel llaman a /api/cron/* con `?token=CRON_SECRET` (al menos 16 caracteres). */
export function cronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET, token = new URL(request.url).searchParams.get("token");
  return Boolean(secret && token && secret.length >= 16 && timingSafeEqual(digest(secret), digest(token)));
}
