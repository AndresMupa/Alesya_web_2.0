import { NextResponse } from "next/server";
import { ADMIN_COOKIE, revokeSession, sameOrigin } from "@/lib/admin-auth";
import { securityLog } from "@/lib/security-log";

export async function POST(request: Request) {
  if (!sameOrigin(request)) { securityLog("origin_rejected", request, { route: "admin-logout" }); return NextResponse.json({ message: "Solicitud no permitida." }, { status: 403 }); }
  const token = /(?:^|;\s*)alesya_admin=([^;]+)/.exec(request.headers.get("cookie") ?? "")?.[1];
  await revokeSession(token);
  securityLog("admin_logout", request);
  const response = NextResponse.redirect(new URL("/admin/login", request.url), 303);
  response.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
  return response;
}
