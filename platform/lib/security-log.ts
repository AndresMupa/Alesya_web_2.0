import "server-only";
import { createHash } from "node:crypto";
import { trustedClientAddress } from "@/lib/client-ip";

export type SecurityEvent =
  | "admin_login_ok" | "admin_login_failed" | "admin_login_blocked" | "admin_logout"
  | "wompi_signature_invalid" | "cron_unauthorized" | "rate_limited" | "origin_rejected" | "csp_violation";

/**
 * Registro de eventos de seguridad: una línea JSON por evento en el log de la aplicación (en cPanel, el de "Setup Node.js App").
 * No guarda datos personales: la dirección del cliente se reduce a una huella corta (con sal propia) que permite ver si varios
 * eventos vienen del mismo origen sin conservar la IP, y `detail` solo admite valores simples que escribe el servidor.
 */
export function securityLog(event: SecurityEvent, request?: Request, detail: Record<string, string | number | boolean> = {}) {
  const address = request ? trustedClientAddress(request) : null;
  const client = address ? createHash("sha256").update(`${process.env.ADMIN_SESSION_SECRET ?? "alesya"}:${address}`).digest("hex").slice(0, 12) : undefined;
  console.warn(`[security] ${JSON.stringify({ event, at: new Date().toISOString(), client, ...detail })}`);
}
