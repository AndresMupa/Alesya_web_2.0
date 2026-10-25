import { getFeaturedProducts, listStoreCategories } from "@/lib/commerce/catalog";
import { categoryMeta } from "@/lib/content";
import { formatMoney } from "@/lib/format";
import { legalPages } from "@/lib/legal";
import { absoluteUrl, site, siteUrl } from "@/lib/site";

// Se arma en cada solicitud: las categorías y los productos cambian desde el panel.
export const dynamic = "force-dynamic";

/**
 * llms.txt: índice en Markdown para asistentes de IA (ChatGPT, Claude, Perplexity, Gemini). Resume qué vende la marca,
 * dónde está, cómo se paga y se envía, y enlaza las páginas que más sirven para responder. Si la base no responde,
 * el archivo sale igual con lo fijo; nunca falla por el catálogo.
 */
export async function GET() {
  const [categories, featured] = await Promise.all([
    listStoreCategories().catch(() => []),
    getFeaturedProducts(12).catch(() => []),
  ]);
  const base = siteUrl();
  const lines = [
    `# ${site.name}`,
    "",
    `> ${site.name} es la marca de robótica educativa, Arduino, impresión 3D, bricolaje y libros de ${site.legalName}, en ${site.address.city} (${site.address.region}, Colombia). Vende kits para aprender construyendo, con envíos a toda Colombia, y ofrece programas de robótica y cultura maker para colegios y formación docente.`,
    "",
    "## Datos clave",
    `- Razón social: ${site.legalName}`,
    `- Sede: ${site.address.street}, ${site.address.city}, ${site.address.region}, ${site.address.countryName}`,
    `- Contacto comercial: ${site.email} · WhatsApp ${site.phone}`,
    "- Envíos: a toda Colombia; la entrega se coordina al confirmar el pago.",
    "- Pagos: en línea con Wompi (tarjeta, PSE, Nequi o Botón Bancolombia) o por transferencia o Nequi confirmada por el equipo.",
    "- Idioma: español (Colombia). Moneda: pesos colombianos (COP).",
    "",
    "## Páginas principales",
    `- [Inicio](${base}/): portada con proyectos, tienda y programas.`,
    `- [Tienda](${base}/catalogo): catálogo completo de kits, electrónica, impresión 3D, bricolaje y libros.`,
    `- [Colegios](${base}/colegios): programa de robótica educativa y cultura maker para colegios, con diagnóstico, dotación y formación docente.`,
    `- [Proyectos](${base}/proyectos): retos de robótica y electrónica por edad, duración y nivel.`,
    `- [Preguntas frecuentes](${base}/preguntas-frecuentes): respuestas sobre productos, envíos, pagos y colegios.`,
    `- [Mapa del sitio](${base}/sitemap.xml): todas las páginas y productos publicados.`,
    "",
    "## Categorías de la tienda",
    ...categories.map(({ category, total }) => `- [${category}](${absoluteUrl(`/catalogo?categoria=${encodeURIComponent(category)}`)}) (${total} ${total === 1 ? "producto" : "productos"}): ${categoryMeta(category).detail}`),
    "",
    "## Productos destacados",
    ...featured.map((product) => `- [${product.name}](${absoluteUrl(`/catalogo/${product.slug}`)}) · ${product.category} · ${formatMoney(product.priceInCents)}`),
    "",
    "## Políticas",
    ...legalPages.map((page) => `- [${page.title}](${absoluteUrl(`/${page.slug}`)})`),
    "",
  ];
  // Las categorías o productos que fallen no deben dejar el índice sin contenido: si no hay datos, esas secciones quedan vacías.
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
