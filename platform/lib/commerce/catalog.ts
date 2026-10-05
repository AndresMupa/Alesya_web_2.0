import "server-only";
import { and, asc, count, desc, eq, gt, inArray, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import { categoryOrder, sortCategories, stockState } from "@/lib/commerce/constants";

/** Lo que la tienda pública puede ver de un producto. */
const storeFields = { slug: products.slug, name: products.name, description: products.description, category: products.category, priceInCents: products.priceInCents, stock: products.stock, backorder: products.backorder, imageUrl: products.imageUrl, featured: products.featured };
export type StoreProduct = { slug: string; name: string; description: string; category: string; priceInCents: number; stock: number; backorder: boolean; imageUrl: string | null; featured: boolean };

/** Solo se vende lo publicado y con precio. */
const sellable = and(eq(products.status, "active"), gt(products.priceInCents, 0));
const categoryRank = sql`case ${products.category} ${sql.join(categoryOrder.map((category, index) => sql`when ${category} then ${index}`), sql` `)} else ${categoryOrder.length} end`;

export const storeSorts = [
  { value: "relevancia", label: "Relevancia" },
  { value: "precio-asc", label: "Precio: menor a mayor" },
  { value: "precio-desc", label: "Precio: mayor a menor" },
  { value: "nuevos", label: "Novedades" },
] as const;
export type StoreSort = (typeof storeSorts)[number]["value"];

export async function listStoreProducts(filters: { category?: string; search?: string; sort?: string } = {}) {
  const search = filters.search?.trim().slice(0, 80);
  const order = filters.sort === "precio-asc" ? [asc(products.priceInCents)] : filters.sort === "precio-desc" ? [desc(products.priceInCents)] : filters.sort === "nuevos" ? [desc(products.createdAt)]
    : [desc(products.featured), categoryRank, asc(products.category), asc(products.position), desc(products.createdAt)];
  return getDb().select(storeFields).from(products)
    .where(and(sellable, filters.category ? eq(products.category, filters.category) : undefined, search ? or(like(products.name, `%${search}%`), like(products.description, `%${search}%`)) : undefined))
    .orderBy(...order).limit(500) as Promise<StoreProduct[]>;
}

/** Categorías con productos a la venta y cuántos hay en cada una, en el orden de la tienda. */
export async function listStoreCategories() {
  const rows = await getDb().select({ category: products.category, total: count() }).from(products).where(sellable).groupBy(products.category);
  const totals = new Map(rows.map((row) => [row.category, row.total]));
  return sortCategories(rows.map((row) => row.category)).map((category) => ({ category, total: totals.get(category) ?? 0 }));
}

export async function getStoreProduct(slug: string) {
  if (!slug || slug.length > 200) return null;
  const [product] = await getDb().select(storeFields).from(products).where(and(sellable, eq(products.slug, slug))).limit(1);
  return (product as StoreProduct | undefined) ?? null;
}

/** Destacados de la portada: los marcados en el panel y, si faltan, los últimos publicados con foto. */
export async function getFeaturedProducts(limit = 4) {
  const rows = await getDb().select(storeFields).from(products).where(sellable)
    .orderBy(desc(products.featured), sql`${products.imageUrl} is null`, desc(products.updatedAt)).limit(limit);
  return rows as StoreProduct[];
}

/** Productos a la venta para el sitemap: dirección, foto y fecha del último cambio. */
export async function listSitemapProducts() {
  return getDb().select({ slug: products.slug, imageUrl: products.imageUrl, updatedAt: products.updatedAt }).from(products).where(sellable).orderBy(desc(products.updatedAt)).limit(2000);
}

export async function getRelatedProducts(product: StoreProduct, limit = 4) {
  const rows = await getDb().select(storeFields).from(products)
    .where(and(sellable, eq(products.category, product.category), sql`${products.slug} <> ${product.slug}`))
    .orderBy(asc(products.position)).limit(limit);
  return rows as StoreProduct[];
}

export const cartItemsSchema = z.array(z.object({ slug: z.string().trim().min(1).max(200), quantity: z.coerce.number().int().min(1).max(99) })).max(50);

export type CartLine = StoreProduct & { quantity: number; lineTotalInCents: number; available: boolean; problem: string | null };

/**
 * Reconstruye un carrito con precios y stock actuales. Nunca confía en el precio que trae el navegador.
 * Las líneas con problemas (agotado, despublicado, sin stock suficiente) llevan `problem`.
 */
export async function resolveCart(items: { slug: string; quantity: number }[]) {
  const wanted = new Map<string, number>();
  for (const item of items) wanted.set(item.slug, Math.min(99, (wanted.get(item.slug) ?? 0) + item.quantity));
  const slugs = Array.from(wanted.keys()).slice(0, 50);
  const rows = slugs.length ? await getDb().select(storeFields).from(products).where(and(sellable, inArray(products.slug, slugs))) as StoreProduct[] : [];
  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  const lines: CartLine[] = [];
  const missing: string[] = [];
  for (const slug of slugs) {
    const product = bySlug.get(slug);
    if (!product) { missing.push(slug); continue; }
    const quantity = wanted.get(slug)!;
    const state = stockState(product);
    const problem = !state.purchasable ? "Agotado" : quantity > state.max ? `Solo hay ${state.max} disponible${state.max === 1 ? "" : "s"}` : null;
    lines.push({ ...product, quantity, lineTotalInCents: product.priceInCents * quantity, available: !problem, problem });
  }
  const subtotalInCents = lines.reduce((acc, line) => acc + line.lineTotalInCents, 0);
  return { lines, missing, subtotalInCents };
}
