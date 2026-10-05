import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { siteHost, siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Solo el dominio canónico (PRODUCTION_URL) se deja rastrear. Cualquier otro nombre que sirva la misma app
 * (nueva.alesyaediciones.com después del cambio de dominio, la IP del servidor…) pide no indexar nada, para que
 * Google no vea contenido duplicado.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const request = await headers();
  const host = (request.get("x-forwarded-host") ?? request.get("host") ?? "").split(",")[0].trim().toLowerCase();
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  if (host && !local && host !== siteHost()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/checkout", "/carrito", "/pedido", "/cotizacion/"] },
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
