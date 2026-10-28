import { after, NextResponse } from "next/server";
import { ADMIN_COOKIE, SESSION_SECONDS, adminConfigured, makeSession, sameOrigin, verifyAdmin } from "@/lib/admin-auth";
import { mailStatus, renderEmail, sendMail } from "@/lib/mail";
import { claimOnce, clearRateLimit, enforceRateLimit } from "@/lib/rate-limit";
import { securityLog } from "@/lib/security-log";
import { storeConfig } from "@/lib/settings";

/** Aviso al correo del equipo cuando el acceso se bloquea por intentos fallidos: uno por hora, sin direcciones ni datos personales. */
async function alertLockout() {
  if (!mailStatus().configured || !await claimOnce("admin-login-alert", 60 * 60_000)) return;
  const mail = renderEmail({
    title: "Intentos de acceso bloqueados en el panel",
    intro: "Se bloquearon varios intentos fallidos de iniciar sesión en el panel de administración. Si no fuiste tú, no hace falta hacer nada: el acceso queda limitado unos minutos. Si se repite, cambia la contraseña del panel.",
    footer: "Aviso automático de seguridad de Alesya.",
  });
  await sendMail({ to: (await storeConfig()).notifyTo, subject: "Aviso de seguridad: intentos de acceso al panel", ...mail });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) { securityLog("origin_rejected", request, { route: "admin-login" }); return NextResponse.json({ message: "Solicitud no permitida." }, { status: 403 }); }
  if (!adminConfigured()) return NextResponse.json({ message: "El acceso administrativo aún no está configurado." }, { status: 503 });
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return NextResponse.json({ message: "Solicitud no válida." }, { status: 413 });
  // Cada intento cuenta (el éxito reinicia solo el cupo de 15 minutos): 5 por dirección cada 15 minutos, 20 por día, y un tope global
  // que protege al servidor del costo de calcular el hash cuando el ataque viene de muchas direcciones.
  const limited = await enforceRateLimit(request, { name: "admin-login", limit: 5, globalLimit: 60, windowMs: 15 * 60_000 }) ?? await enforceRateLimit(request, { name: "admin-login-day", limit: 20, windowMs: 24 * 60 * 60_000 });
  if (limited) {
    securityLog("admin_login_blocked", request);
    if (limited.status === 429) after(() => alertLockout().catch((error) => console.error("admin_lockout_alert_failed", error)));
    return limited;
  }
  const body = await request.json().catch(() => null) as { email?: unknown; password?: unknown } | null;
  if (!body || typeof body.email !== "string" || typeof body.password !== "string" || !await verifyAdmin(body.email.trim(), body.password)) {
    securityLog("admin_login_failed", request);
    return NextResponse.json({ message: "Correo o contraseña incorrectos." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  await clearRateLimit(request, "admin-login");
  securityLog("admin_login_ok", request);
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(ADMIN_COOKIE, makeSession(), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: SESSION_SECONDS });
  return response;
}
