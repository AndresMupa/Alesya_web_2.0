import { NextResponse, type NextRequest } from "next/server";
import { legacyUrlAction } from "@/lib/legacy-url";
import { siteHost, siteUrl } from "@/lib/site";

/**
 * Dominio único: con `CANONICAL_REDIRECT=1` toda visita que llegue por otro nombre (alesyaediciones.com sin www,
 * nueva.alesyaediciones.com después del cambio…) se redirige de forma permanente al dominio de PRODUCTION_URL,
 * conservando la ruta. Está apagado por defecto para no afectar el sitio mientras se prepara el cambio de dominio.
 * No toca /api (webhooks de Wompi, cron) ni los archivos de /_next.
 */
export function proxy(request: NextRequest) {
  const legacy = legacyUrlAction(request.nextUrl);
  if (legacy === "gone") return new NextResponse("Este recurso del sitio anterior ya no está disponible.", {
    status: 410, headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" },
  });
  if (legacy === "clean-catalog") {
    const clean = new URL(request.nextUrl.pathname + request.nextUrl.search, siteUrl());
    clean.searchParams.delete("action");
    return NextResponse.redirect(clean, 308);
  }
  if (process.env.CANONICAL_REDIRECT !== "1") return NextResponse.next();
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(",")[0].trim().toLowerCase();
  if (!host || host === siteHost() || /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) return NextResponse.next();
  return NextResponse.redirect(new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, siteUrl()), 308);
}

export const config = { matcher: ["/((?!api/|_next/static|_next/image).*)"] };
