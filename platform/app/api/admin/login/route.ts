import { after, NextResponse } from "next/server";
import { makeChallenge, twoFactorConfig, verifySecondFactor } from "@/lib/admin-2fa";
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
  const twoFactor = twoFactorConfig();
  if (twoFactor.state === "invalid") {
    // Con el segundo factor mal configurado no se permite entrar solo con contraseña.
    console.error("admin_totp_secret_invalid");
    return NextResponse.json({ message: "La verificación en dos pasos no está bien configurada." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  // Cada intento cuenta, tanto el de contraseña como el de código (el éxito reinicia solo el cupo de 15 minutos): 5 por dirección cada
  // 15 minutos, 20 por día, y un tope global que protege al servidor del costo de calcular el hash cuando el ataque viene de muchas direcciones.
  const limited = await enforceRateLimit(request, { name: "admin-login", limit: 5, globalLimit: 60, windowMs: 15 * 60_000 }) ?? await enforceRateLimit(request, { name: "admin-login-day", limit: 20, windowMs: 24 * 60 * 60_000 });
  if (limited) {
    securityLog("admin_login_blocked", request, { reason: "rate_limit" });
    if (limited.status === 429) after(() => alertLockout().catch((error) => console.error("admin_lockout_alert_failed", error)));
    return limited;
  }
  const body = await request.json().catch(() => null) as { email?: unknown; password?: unknown; challenge?: unknown; code?: unknown } | null;
  const noStore = { "Cache-Control": "no-store" };

  // Paso 2: código de la app autenticadora (o de recuperación) con el token que se entregó tras la contraseña.
  if (body && typeof body.challenge === "string") {
    const result = typeof body.code === "string" ? await verifySecondFactor(body.challenge, body.code) : null;
    if (!result?.ok) {
      const reason = result?.reason ?? "bad_body";
      securityLog("admin_login_failed", request, { step: "code", reason });
      if (result && !result.restart) return NextResponse.json({ message: "Código incorrecto o vencido." }, { status: 401, headers: noStore });
      return NextResponse.json({ message: "La verificación venció o se agotaron los intentos. Ingresa de nuevo tu contraseña.", restart: true }, { status: 401, headers: noStore });
    }
    return startSession(request, { second_factor: result.method });
  }

  // Paso 1: correo y contraseña.
  if (!body || typeof body.email !== "string" || typeof body.password !== "string" || !await verifyAdmin(body.email.trim(), body.password)) {
    securityLog("admin_login_failed", request, { step: "password", reason: body ? "credentials" : "bad_body" });
    return NextResponse.json({ message: "Correo o contraseña incorrectos." }, { status: 401, headers: noStore });
  }
  // Contraseña correcta con segundo factor activo: aún no hay sesión, solo un token de vida corta para enviar el código.
  if (twoFactor.state === "on") return NextResponse.json({ step: "code", challenge: makeChallenge() }, { headers: noStore });
  securityLog("admin_2fa_disabled", request);
  return startSession(request, { second_factor: "none" });
}

async function startSession(request: Request, detail: { second_factor: string }) {
  await clearRateLimit(request, "admin-login");
  securityLog("admin_login_ok", request, detail);
  if (detail.second_factor === "recovery") securityLog("admin_recovery_code_used", request);
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(ADMIN_COOKIE, makeSession(), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: SESSION_SECONDS });
  return response;
}
