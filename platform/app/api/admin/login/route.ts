import { NextResponse } from "next/server";
import { ADMIN_COOKIE, SESSION_SECONDS, adminConfigured, makeSession, sameOrigin, verifyAdmin } from "@/lib/admin-auth";
import { clearRateLimit, enforceRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ message: "Solicitud no permitida." }, { status: 403 });
  if (!adminConfigured()) return NextResponse.json({ message: "El acceso administrativo aún no está configurado." }, { status: 503 });
  const limited = await enforceRateLimit(request, { name: "admin-login", limit: 5, windowMs: 15 * 60_000 });
  if (limited) return limited;
  const body = await request.json().catch(() => null) as { email?: unknown; password?: unknown } | null;
  if (!body || typeof body.email !== "string" || typeof body.password !== "string" || !await verifyAdmin(body.email.trim(), body.password)) return NextResponse.json({ message: "Correo o contraseña incorrectos." }, { status: 401 });
  await clearRateLimit(request, "admin-login");
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(ADMIN_COOKIE, makeSession(), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: SESSION_SECONDS });
  return response;
}
