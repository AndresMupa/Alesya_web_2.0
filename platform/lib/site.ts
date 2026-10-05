/**
 * Identidad pública del sitio: dominio canónico, nombre y datos de contacto. Seguro para cliente y servidor.
 * El dominio sale de `PRODUCTION_URL` (cPanel → Setup Node.js App). Al pasar al dominio principal basta con
 * cambiar esa variable a https://www.alesyaediciones.com y reiniciar: enlaces canónicos, sitemap, robots, datos
 * estructurados, correos y pagos toman el nuevo dominio.
 */
const FALLBACK_URL = "https://nueva.alesyaediciones.com";

export function siteUrl() {
  const value = (typeof process !== "undefined" ? process.env.PRODUCTION_URL : undefined)?.trim().replace(/\/+$/, "");
  return value && /^https?:\/\/[^/]+$/.test(value) ? value : FALLBACK_URL;
}

export const siteHost = () => new URL(siteUrl()).host;

/** URL absoluta a partir de una ruta del sitio (`/catalogo`) o de una URL ya absoluta. */
export function absoluteUrl(pathOrUrl: string) {
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  return `${siteUrl()}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

export const site = {
  name: "Alesya X-Tech",
  legalName: "Alesya Ediciones S.A.",
  publisher: "Alesya Ediciones",
  title: "Alesya X-Tech | Robótica educativa, Arduino e impresión 3D en Colombia",
  description: "Kits de robótica LEGO, Arduino, sensores, impresión 3D, bricolaje y libros, con programas para colegios y formación docente. Aprende construyendo, con envíos a toda Colombia.",
  keywords: ["robótica educativa", "kits de robótica", "LEGO EV3", "LEGO WeDo", "Arduino", "impresión 3D", "cultura maker", "STEAM", "robótica para colegios", "formación docente", "Colombia"],
  locale: "es_CO",
  email: "comercial@alesyaediciones.com",
  phone: "+57 300 593 7840",
  phoneHref: "tel:+573005937840",
  address: { street: "Cra 2B # 15A-07", city: "Funza", region: "Cundinamarca", country: "CO", countryName: "Colombia" },
  ogImage: { url: "/media/og-alesya.jpg", width: 1200, height: 630, alt: "Estudiantes con sus robots: robótica, Arduino e impresión 3D para aprender haciendo" },
  logo: "/media/alesya-x-tech.png",
} as const;

/** Serializa datos estructurados (JSON-LD) escapando `<` para que un texto nunca cierre la etiqueta `<script>`. */
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");

/** Organización y sitio web para Google (panel de conocimiento, logo y datos de contacto). */
export function organizationJsonLd() {
  const url = siteUrl();
  return [
    {
      "@context": "https://schema.org", "@type": "Organization", "@id": `${url}/#organizacion`, name: site.publisher, alternateName: site.name, legalName: site.legalName, url,
      logo: absoluteUrl(site.logo), image: absoluteUrl(site.ogImage.url), email: site.email, telephone: site.phone,
      address: { "@type": "PostalAddress", streetAddress: site.address.street, addressLocality: site.address.city, addressRegion: site.address.region, addressCountry: site.address.country },
      contactPoint: [{ "@type": "ContactPoint", contactType: "sales", telephone: site.phone, email: site.email, areaServed: "CO", availableLanguage: ["es"] }],
    },
    { "@context": "https://schema.org", "@type": "WebSite", "@id": `${url}/#sitio`, url, name: site.name, inLanguage: "es-CO", publisher: { "@id": `${url}/#organizacion` },
      potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${url}/catalogo?q={search_term_string}` }, "query-input": "required name=search_term_string" } },
  ];
}
