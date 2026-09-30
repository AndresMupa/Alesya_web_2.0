import "server-only";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { inventoryEvents, products } from "@/db/schema";
import { productStatuses, type ProductStatus } from "@/lib/commerce/constants";
import { slugify } from "@/lib/format";
import { DomainError } from "@/lib/http";

export type AdminProduct = typeof products.$inferSelect;

export async function listAdminProducts() {
  return getDb().select().from(products).orderBy(asc(products.category), asc(products.position), desc(products.createdAt)).limit(2000);
}

export type ProductInput = { name: string; sku: string; priceInCents: number; stock: number; category: string; description: string; imageUrl?: string | null; status?: ProductStatus; featured?: boolean; backorder?: boolean };

const uniqueSlug = (name: string) => `${slugify(name) || "producto"}-${crypto.randomUUID().slice(0, 5)}`;
const nextPosition = async (category: string) => {
  const [row] = await getDb().select({ next: sql<number>`coalesce(max(${products.position}), -1) + 1` }).from(products).where(eq(products.category, category));
  return Number(row?.next ?? 0);
};

export async function createProduct(input: ProductInput) {
  const db = getDb();
  const now = new Date();
  const id = crypto.randomUUID();
  const sku = input.sku.trim().toUpperCase();
  const [duplicate] = await db.select({ id: products.id }).from(products).where(eq(products.sku, sku)).limit(1);
  if (duplicate) throw new DomainError(`Ya existe un producto con el SKU ${sku}.`);
  // Sin precio no puede publicarse: queda como borrador aunque se pida "active".
  const status = input.priceInCents > 0 ? (input.status ?? "active") : input.status === "archived" ? "archived" : "draft";
  await db.batch([
    db.insert(products).values({ id, slug: uniqueSlug(input.name), sku, name: input.name.trim(), description: input.description.trim(), category: input.category.trim(), priceInCents: input.priceInCents, stock: input.stock, status, imageUrl: input.imageUrl?.trim() || null, position: await nextPosition(input.category.trim()), featured: input.featured ?? false, backorder: input.backorder ?? false, createdAt: now, updatedAt: now }),
    ...(input.stock ? [db.insert(inventoryEvents).values({ id: crypto.randomUUID(), productId: id, quantityDelta: input.stock, reason: "initial_stock", createdAt: now })] : []),
  ]);
  return id;
}

export type ProductPatch = Partial<Omit<ProductInput, "stock" | "sku">> & { sku?: string };

export async function updateProduct(id: string, patch: ProductPatch) {
  const db = getDb();
  const [current] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!current) throw new DomainError("El producto no existe.", 404);
  const changes: Record<string, unknown> = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(patch)) if (value !== undefined) changes[key] = typeof value === "string" ? value.trim() : value;
  if (typeof changes.sku === "string") {
    changes.sku = (changes.sku as string).toUpperCase();
    if (changes.sku !== current.sku) {
      const [duplicate] = await db.select({ id: products.id }).from(products).where(eq(products.sku, changes.sku as string)).limit(1);
      if (duplicate) throw new DomainError(`Ya existe un producto con el SKU ${changes.sku}.`);
    }
  }
  if (changes.imageUrl === "") changes.imageUrl = null;
  const price = (changes.priceInCents as number | undefined) ?? current.priceInCents;
  const status = (changes.status as string | undefined) ?? current.status;
  if (status === "active" && price <= 0) throw new DomainError("Asigna un precio antes de publicar el producto.");
  if (changes.category && changes.category !== current.category) changes.position = await nextPosition(changes.category as string);
  await db.update(products).set(changes).where(eq(products.id, id));
}

export async function reorderProducts(items: { id: string; position: number; category: string }[]) {
  const db = getDb();
  const now = new Date();
  const [first, ...rest] = items.map((item) => db.update(products).set({ position: item.position, category: item.category, updatedAt: now }).where(eq(products.id, item.id)));
  if (first) await db.batch([first, ...rest]);
}

/** Acciones masivas desde la vista de tabla. */
export async function bulkUpdateProducts(ids: string[], action: "publish" | "draft" | "archive" | "feature" | "unfeature") {
  const db = getDb();
  const now = new Date();
  if (action === "publish") {
    const rows = await db.select({ id: products.id, price: products.priceInCents }).from(products).where(inArray(products.id, ids));
    const priced = rows.filter((row) => row.price > 0).map((row) => row.id);
    if (priced.length) await db.update(products).set({ status: "active", updatedAt: now }).where(inArray(products.id, priced));
    return { updated: priced.length, skipped: rows.length - priced.length };
  }
  const changes = action === "draft" ? { status: "draft" } : action === "archive" ? { status: "archived", featured: false } : { featured: action === "feature" };
  const result = await db.update(products).set({ ...changes, updatedAt: now }).where(inArray(products.id, ids));
  return { updated: result.rowsAffected, skipped: 0 };
}

// ── CSV ─────────────────────────────────────────────────────────────────────

/** Mismo formato que `inventario-alesya.csv`, con columnas opcionales para foto, estado y banderas. */
export const productCsvHeader = ["cantidad", "nombre", "categoria", "sku_ref", "precio_cop", "estado", "imagen", "destacado", "bajo_pedido", "descripcion"];

export async function exportProducts() {
  const rows = await listAdminProducts();
  return rows.map((product) => [product.stock, product.name, product.category, product.sku, Math.round(product.priceInCents / 100) || "", product.status, product.imageUrl, product.featured ? "SI" : "", product.backorder ? "SI" : "", product.description]);
}

const yes = (value: string) => /^(si|sí|yes|true|1|x)$/i.test(value.trim());
const pick = (record: Record<string, string>, ...keys: string[]) => keys.map((key) => record[key]).find((value) => value !== undefined && value !== "") ?? "";
const number = (value: string) => Number(value.replace(/[$\s.]/g, "").replace(",", "."));

/**
 * Importa o actualiza productos por SKU. Los nuevos entran con su stock inicial; en los existentes
 * se actualizan nombre, categoría, descripción, precio y foto cuando el archivo los trae. El stock de
 * los existentes solo cambia con `updateStock` (conteo físico), y siempre con un evento de inventario.
 */
export async function importProducts(records: Record<string, string>[], options: { updateStock: boolean }) {
  const db = getDb();
  const current = await db.select({ id: products.id, sku: products.sku, stock: products.stock, status: products.status, priceInCents: products.priceInCents, category: products.category, position: products.position }).from(products);
  const bySku = new Map(current.map((row) => [row.sku, row]));
  const positions = new Map<string, number>();
  for (const row of current) positions.set(row.category, Math.max(positions.get(row.category) ?? 0, row.position + 1));
  const now = new Date();
  const statements = [];
  let created = 0, updated = 0, invalid = 0;
  const validStatus = new Set<string>(productStatuses.map((status) => status.value));

  for (const record of records) {
    const name = pick(record, "nombre", "name", "producto").slice(0, 160);
    if (name.length < 3) { invalid++; continue; }
    const sku = (pick(record, "sku_ref", "sku", "referencia") || slugify(name)).toUpperCase().slice(0, 50);
    const givenCategory = pick(record, "categoria", "category").slice(0, 80);
    const category = givenCategory || "Electrónica";
    const rawPrice = pick(record, "precio_cop", "precio", "price");
    const priceInCents = rawPrice ? Math.max(0, Math.round(number(rawPrice) || 0)) * 100 : null;
    const rawStock = pick(record, "cantidad", "stock", "existencias");
    const stock = rawStock ? Math.max(0, Math.trunc(number(rawStock) || 0)) : null;
    const givenDescription = pick(record, "descripcion", "notas", "description").slice(0, 1000);
    const description = givenDescription || `${name} — inventario Alesya.`;
    const imageUrl = pick(record, "imagen", "image_url", "foto").slice(0, 500) || null;
    const requested = pick(record, "estado", "status").toLowerCase();
    const flags = { ...(record.destacado !== undefined && { featured: yes(record.destacado) }), ...(record.bajo_pedido !== undefined && { backorder: yes(record.bajo_pedido) }) };
    const existing = bySku.get(sku);

    if (existing) {
      const price = priceInCents ?? existing.priceInCents;
      const status = validStatus.has(requested) ? requested : existing.status === "draft" && price > 0 && priceInCents ? "active" : existing.status;
      // En existentes solo cambia lo que trae el archivo: una columna ausente o vacía no borra datos.
      statements.push(db.update(products).set({ name, ...(givenCategory && { category: givenCategory }), ...(givenDescription && { description: givenDescription }), ...(priceInCents !== null && { priceInCents }), ...(imageUrl && { imageUrl }), ...flags, status: status === "active" && price <= 0 ? "draft" : status, updatedAt: now }).where(eq(products.id, existing.id)));
      if (options.updateStock && stock !== null && stock !== existing.stock) {
        statements.push(db.update(products).set({ stock }).where(eq(products.id, existing.id)));
        statements.push(db.insert(inventoryEvents).values({ id: crypto.randomUUID(), productId: existing.id, quantityDelta: stock - existing.stock, reason: "stock_count", createdAt: now }));
      }
      updated++;
    } else {
      const id = crypto.randomUUID();
      const position = positions.get(category) ?? 0;
      positions.set(category, position + 1);
      const price = priceInCents ?? 0;
      const status = validStatus.has(requested) ? requested : price > 0 ? "active" : "draft";
      statements.push(db.insert(products).values({ id, slug: uniqueSlug(name), sku, name, description, category, priceInCents: price, stock: stock ?? 0, status: status === "active" && price <= 0 ? "draft" : status, imageUrl, position, featured: flags.featured ?? false, backorder: flags.backorder ?? false, createdAt: now, updatedAt: now }));
      if (stock) statements.push(db.insert(inventoryEvents).values({ id: crypto.randomUUID(), productId: id, quantityDelta: stock, reason: "initial_stock", createdAt: now }));
      bySku.set(sku, { id, sku, stock: stock ?? 0, status, priceInCents: price, category, position });
      created++;
    }
  }
  for (let index = 0; index < statements.length; index += 200) {
    const [first, ...rest] = statements.slice(index, index + 200);
    await db.batch([first, ...rest]);
  }
  return { created, updated, invalid };
}
