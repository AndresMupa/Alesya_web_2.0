import { NextResponse } from "next/server";
import { ADMIN_COOKIE, sameOrigin } from "@/lib/admin-auth";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ message: "Solicitud no permitida." }, { status: 403 });
  const response = NextResponse.redirect(new URL("/admin/login", request.url), 303);
  response.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
  return response;
}
