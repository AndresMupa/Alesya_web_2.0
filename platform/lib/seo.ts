import type { Metadata } from "next";
import { absoluteUrl, site } from "@/lib/site";

type PageSeo = {
  /** Título de la página; la plantilla del layout añade " | Alesya X-Tech". Con `absolute` se usa tal cual. */
  title: string;
  absolute?: boolean;
  description: string;
  /** Ruta canónica (`/catalogo`). */
  path: string;
  image?: { url: string; alt?: string; width?: number; height?: number } | null;
  /** Páginas privadas o sin valor de búsqueda (carrito, pedido…): no se indexan pero sus enlaces sí se siguen. */
  noindex?: boolean;
  type?: "website" | "article";
};

/**
 * Metadata completa de una página pública. En Next, `openGraph` y `twitter` de una página reemplazan por completo
 * los del layout, así que aquí se arman enteros (con la imagen por defecto cuando la página no trae una).
 */
export function pageMetadata({ title, absolute, description, path, image, noindex, type = "website" }: PageSeo): Metadata {
  const url = absoluteUrl(path);
  const picture = image ?? site.ogImage;
  const images = [{ url: absoluteUrl(picture.url), alt: picture.alt ?? title, ...(picture.width && { width: picture.width, height: picture.height }) }];
  const fullTitle = absolute ? title : `${title} | ${site.name}`;
  return {
    title: absolute ? { absolute: title } : title,
    description,
    alternates: { canonical: url },
    openGraph: { type, locale: site.locale, siteName: site.name, url, title: fullTitle, description, images },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: images.map((item) => item.url) },
    ...(noindex && { robots: { index: false, follow: true } }),
  };
}

/** Recorta un texto a ~160 caracteres sin cortar palabras, para la meta descripción. */
export function summarize(text: string, max = 160) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 80 ? cut.lastIndexOf(" ") : cut.length).replace(/[,.;:]$/, "")}…`;
}
