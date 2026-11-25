// Atribución del primer toque (UTM, referente y página de entrada). Seguro para cliente y servidor.
// Todo lo que llega de la URL o del navegador es dato no confiable: aquí se limpia y se limita antes de guardarlo.
// Limpiar nunca rechaza el formulario: un UTM raro no debe costar un lead.

export const attributionLimits = { source: 40, medium: 40, campaign: 40, content: 60, term: 80, referrer: 200, landingPage: 200 } as const;

export type Attribution = { utmSource: string; utmMedium: string; utmCampaign: string; utmContent: string; utmTerm: string; referrer: string; landingPage: string };
export const emptyAttribution: Attribution = { utmSource: "", utmMedium: "", utmCampaign: "", utmContent: "", utmTerm: "", referrer: "", landingPage: "" };

/** Primer segmento de las rutas cuyo resto es un token o un dato privado: nunca se guarda más que el primer segmento. */
const privatePrefixes = new Set(["propuesta", "cotizacion", "baja", "pedido", "checkout", "carrito", "admin", "api"]);

/** Etiqueta de campaña: solo letras, números y `. _ + : -` en minúsculas, con tope de longitud. */
export function cleanTag(value: unknown, max: number) {
  return (typeof value === "string" ? value : "").normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}._+:\- ]/gu, "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Ruta sin consulta ni fragmento y sin los tramos que llevan tokens (propuestas, cotizaciones, bajas, pedidos). */
export function cleanPath(value: unknown) {
  const raw = typeof value === "string" ? value.split(/[?#]/)[0] : "";
  if (!raw.startsWith("/")) return "";
  const segments = raw.replace(/[^\p{L}\p{N}/._~%\-]/gu, "").split("/").filter(Boolean);
  const kept = privatePrefixes.has(segments[0]?.toLowerCase() ?? "") ? segments.slice(0, 1) : segments;
  return `/${kept.join("/")}`.slice(0, attributionLimits.landingPage);
}

/** Origen y ruta limpia de una URL externa (sin consulta ni fragmento). Solo http(s). */
export function cleanReferrer(value: unknown) {
  if (typeof value !== "string" || !value) return "";
  try {
    const url = new URL(value.slice(0, 500));
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    const path = cleanPath(url.pathname);
    return `${url.origin}${path === "/" ? "" : path}`.slice(0, attributionLimits.referrer);
  } catch { return ""; }
}

export function cleanAttribution(input: Partial<Record<keyof Attribution, unknown>>): Attribution {
  return {
    utmSource: cleanTag(input.utmSource, attributionLimits.source), utmMedium: cleanTag(input.utmMedium, attributionLimits.medium), utmCampaign: cleanTag(input.utmCampaign, attributionLimits.campaign),
    utmContent: cleanTag(input.utmContent, attributionLimits.content), utmTerm: cleanTag(input.utmTerm, attributionLimits.term),
    referrer: cleanReferrer(input.referrer), landingPage: cleanPath(input.landingPage),
  };
}

/** Toque de una visita: UTM de la URL, referente externo y ruta de entrada. `ownHost` evita contar la navegación interna como referente. */
export function touchFromUrl(location: { search: string; pathname: string }, referrer: string, ownHost: string): Attribution {
  const params = new URLSearchParams(location.search);
  let external = "";
  try { external = referrer && new URL(referrer).host !== ownHost ? referrer : ""; } catch { /* referente ilegible: se ignora */ }
  return cleanAttribution({ utmSource: params.get("utm_source"), utmMedium: params.get("utm_medium"), utmCampaign: params.get("utm_campaign"), utmContent: params.get("utm_content"), utmTerm: params.get("utm_term"), referrer: external, landingPage: location.pathname });
}

/** ¿El toque trae alguna señal de origen (UTM o referente externo)? Una visita directa no la tiene. */
export const hasSignal = (touch: Attribution) => !!(touch.utmSource || touch.utmMedium || touch.utmCampaign || touch.referrer);
