import "server-only";
import { eq, sql } from "drizzle-orm";
import type { getDb } from "@/db";
import { inventoryEvents, orderItems, products } from "@/db/schema";

type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Moves stock for every item of an order that maps to an administrable product.
 * `direction` is -1 when a sale is confirmed and +1 when it is reversed.
 * Featured catalog items that are not stored in `products` have no stock to track.
 */
export async function moveOrderStock(tx: Tx, orderId: string, direction: 1 | -1, reason: string) {
  const items = await tx.select({ slug: orderItems.productSlug, quantity: orderItems.quantity }).from(orderItems).where(eq(orderItems.orderId, orderId));
  const now = new Date();
  for (const item of items) {
    const [product] = await tx.select({ id: products.id }).from(products).where(eq(products.slug, item.slug)).limit(1);
    if (!product) continue;
    const delta = direction * item.quantity;
    await tx.update(products).set({ stock: sql`${products.stock} + ${delta}`, updatedAt: now }).where(eq(products.id, product.id));
    await tx.insert(inventoryEvents).values({ id: crypto.randomUUID(), productId: product.id, quantityDelta: delta, reason, orderId, createdAt: now });
  }
}

export async function adjustStock(db: Db, productId: string, delta: number, reason: string) {
  return db.transaction(async (tx) => {
    const now = new Date();
    const result = await tx.update(products).set({ stock: sql`${products.stock} + ${delta}`, updatedAt: now }).where(eq(products.id, productId));
    if (!result.rowsAffected) return false;
    await tx.insert(inventoryEvents).values({ id: crypto.randomUUID(), productId, quantityDelta: delta, reason, createdAt: now });
    return true;
  });
}
