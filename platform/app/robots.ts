import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { siteHost, siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Rutas privadas o transaccionales: ningún buscador ni asistente de IA debe indexarlas. */
const privatePaths = ["/admin", "/api/", "/checkout", "/carrito", "/pedido", "/cotizacion/"];

/**
 * Bots de IA que citan o consultan el sitio: ChatGPT (OpenAI), Claude (Anthropic), Perplexity, Gemini (Google-Extended
 * no afecta a la búsqueda de Google, solo al uso de contenido para entrenar y responder con Gemini). Se nombran uno a
 * uno para que la política sea explícita: pueden leer lo público, igual que Googlebot.
 */
const aiBots = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User",
  "ClaudeBot", "Claude-SearchBot", "Claude-User", "anthropic-ai",
  "PerplexityBot", "Perplexity-User",
  "Google-Extended",
];

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
    rules: [
      { userAgent: "*", allow: "/", disallow: privatePaths },
      ...aiBots.map((userAgent) => ({ userAgent, allow: "/", disallow: privatePaths })),
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
