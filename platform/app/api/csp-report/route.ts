import { PUBLIC_BODY_LIMIT } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { securityLog } from "@/lib/security-log";

/**
 * Receptor de los avisos de la política de contenido en modo «solo reporte» (ver next.config.ts). Guarda únicamente la directiva
 * y el origen bloqueado, sin ruta ni parámetros de la página, para decidir qué ajustar antes de activar la política completa.
 */
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > PUBLIC_BODY_LIMIT) return new Response(null, { status: 413 });
  const limited = await enforceRateLimit(request, { name: "csp-report", limit: 30, globalLimit: 600, windowMs: 15 * 60_000 });
  if (limited) return new Response(null, { status: limited.status === 429 ? 204 : limited.status });
  const body = await request.json().catch(() => null) as { "csp-report"?: Record<string, unknown> } | null;
  const report = body?.["csp-report"];
  if (report && typeof report === "object") {
    const directive = String(report["effective-directive"] ?? report["violated-directive"] ?? "").slice(0, 40);
    let blocked = String(report["blocked-uri"] ?? "").slice(0, 200);
    try { blocked = new URL(blocked).origin; } catch { /* inline, eval, data… se registra tal cual */ }
    securityLog("csp_violation", request, { directive, blocked });
  }
  return new Response(null, { status: 204 });
}
