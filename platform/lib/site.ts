/**
 * Identidad pública del sitio: dominio canónico, nombre y datos de contacto. Seguro para cliente y servidor.
 * El dominio sale de `PRODUCTION_URL` (cPanel → Setup Node.js App): enlaces canónicos, sitemap, robots, datos
 * estructurados, correos y pagos lo toman de ahí. En el navegador esa variable no existe y se usa el respaldo, que
 * desde el cambio de dominio (29 de octubre de 2026) es el dominio principal.
 */
const FALLBACK_URL = "https://www.alesyaediciones.com";

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
  keywords: ["robótica educativa", "kits de robótica", "LEGO EV3", "LEGO WeDo", "Arduino", "impresión 3D", "cultura maker", "STEAM", "robótica para colegios", "formación docente", "editorial", "libros escolares", "cuentos", "producción editorial", "plan lector", "preicfes", "pruebas Saber 11", "capacitación docente", "Colombia"],
  /** Quiénes somos para buscadores y asistentes de IA: todas las líneas de la empresa, no solo la tienda de tecnología. */
  about: "Alesya Ediciones es una editorial colombiana con sede en Funza (Cundinamarca). Publica libros escolares, literatura y cuentos, ofrece producción editorial, plan lector, preparación preicfes y capacitaciones para docentes. Su línea Alesya X-Tech lleva la robótica educativa, la electrónica y la impresión 3D a colegios y familias, con libros y con robots.",
  businessLines: [
    { name: "Editorial", detail: "Libros escolares, literatura y cuentos, y servicios de producción editorial." },
    { name: "Plan lector", detail: "Plan lector para colegios." },
    { name: "Robótica", detail: "Libros de robótica y kits de robots, como LEGO EV3 y LEGO WeDo, para aprender construyendo." },
    { name: "Electrónica e impresión 3D", detail: "Arduino, sensores, componentes e impresión 3D." },
    { name: "Preicfes", detail: "Preparación para las pruebas Saber 11 del ICFES." },
    { name: "Capacitaciones", detail: "Formación y capacitación para docentes." },
  ],
  locale: "es_CO",
  email: "comercial@alesyaediciones.com",
  phone: "+57 300 593 7840",
  phoneHref: "tel:+573005937840",
  address: { street: "Cra 2B # 15A-07", city: "Funza", region: "Cundinamarca", country: "CO", countryName: "Colombia" },
  ogImage: { url: "/media/og-alesya.jpg", width: 1200, height: 630, alt: "Estudiantes con sus robots: robótica, Arduino e impresión 3D para aprender haciendo" },
  logo: "/media/alesya-x-tech.png",
  /** Perfiles oficiales (Instagram, YouTube, LinkedIn…). Con URLs aquí, la entidad de la organización las declara en `sameAs`. */
  instagram: "https://www.instagram.com/alesya0108/",
  socials: ["https://www.instagram.com/alesya0108/"] as string[],
} as const;

/** Serializa datos estructurados (JSON-LD) escapando `<` para que un texto nunca cierre la etiqueta `<script>`. */
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");

/** Organización y sitio web para Google (panel de conocimiento, logo y datos de contacto). */
export function organizationJsonLd() {
  const url = siteUrl();
  return [
    {
      "@context": "https://schema.org", "@type": "Organization", "@id": `${url}/#organizacion`, name: site.publisher, alternateName: site.name, legalName: site.legalName, url,
      description: site.about, knowsAbout: [...site.keywords],
      ...(site.socials.length > 0 ? { sameAs: site.socials } : {}),
      logo: absoluteUrl(site.logo), image: absoluteUrl(site.ogImage.url), email: site.email, telephone: site.phone,
      address: { "@type": "PostalAddress", streetAddress: site.address.street, addressLocality: site.address.city, addressRegion: site.address.region, addressCountry: site.address.country },
      contactPoint: [{ "@type": "ContactPoint", contactType: "sales", telephone: site.phone, email: site.email, areaServed: "CO", availableLanguage: ["es"] }],
    },
    { "@context": "https://schema.org", "@type": "WebSite", "@id": `${url}/#sitio`, url, name: site.name, inLanguage: "es-CO", publisher: { "@id": `${url}/#organizacion` },
      potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${url}/catalogo?q={search_term_string}` }, "query-input": "required name=search_term_string" } },
  ];
}
