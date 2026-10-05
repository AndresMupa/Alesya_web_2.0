import type { MetadataRoute } from "next";
import { listSitemapProducts, listStoreCategories } from "@/lib/commerce/catalog";
import { legalPages } from "@/lib/legal";
import { absoluteUrl, siteUrl } from "@/lib/site";

// Se arma en cada solicitud: el catálogo cambia desde el panel y el dominio sale de PRODUCTION_URL en el servidor.
export const dynamic = "force-dynamic";

/** Mapa del sitio para Google: páginas públicas y cada producto a la venta con su foto. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const pages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/catalogo`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/colegios`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/proyectos`, changeFrequency: "monthly", priority: 0.7 },
    ...legalPages.map((page) => ({ url: `${base}/${page.slug}`, changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
  const [products, categories] = await Promise.all([
    listSitemapProducts().catch((error) => { console.error("sitemap_products_failed", error); return []; }),
    listStoreCategories().catch(() => []),
  ]);
  return [...pages, ...categories.map(({ category }) => ({ url: `${base}/catalogo?categoria=${encodeURIComponent(category)}`, changeFrequency: "weekly" as const, priority: 0.6 })), ...products.map((product) => ({
    url: `${base}/catalogo/${product.slug}`, lastModified: product.updatedAt, changeFrequency: "weekly" as const, priority: 0.7,
    ...(product.imageUrl && { images: [absoluteUrl(product.imageUrl)] }),
  }))];
}
