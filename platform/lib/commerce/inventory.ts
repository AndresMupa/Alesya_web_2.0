import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { inventoryEvents, orderEvents, orderItems, orders, products } from "@/db/schema";

type Db = ReturnType<typeof getDb>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Mueve el stock de cada ítem de un pedido que corresponde a un producto administrable.
 * `direction` es -1 cuando se confirma una venta y +1 cuando se revierte. Siempre deja un evento.
 */
export async function moveOrderStock(tx: Tx, orderId: string, direction: 1 | -1, reason: string) {
  const items = await tx.select({ slug: orderItems.productSlug, quantity: orderItems.quantity }).from(orderItems).where(eq(orderItems.orderId, orderId));
  const now = new Date();
  for (const item of items) {
    const [product] = await tx.select({ id: products.id, name: products.name, stock: products.stock, backorder: products.backorder }).from(products).where(eq(products.slug, item.slug)).limit(1);
    if (!product) continue;
    const delta = direction * item.quantity;
    await tx.update(products).set({ stock: sql`${products.stock} + ${delta}`, updatedAt: now }).where(eq(products.id, product.id));
    await tx.insert(inventoryEvents).values({ id: crypto.randomUUID(), productId: product.id, quantityDelta: delta, reason, orderId, createdAt: now });
    // Se vendió más de lo que había (dos clientes a la vez, o bajo pedido): el pedido queda pagado pero el equipo debe verlo.
    if (direction === -1 && product.stock < item.quantity) {
      await tx.insert(orderEvents).values({ id: crypto.randomUUID(), orderId, type: "stock_warning", detail: `${product.name}: se vendieron ${item.quantity} y ${product.stock <= 0 ? "no había stock" : `solo había ${product.stock}`}${product.backorder ? " (bajo pedido)" : ""}. Confirmar disponibilidad con el proveedor.`, createdAt: new Date(now.getTime() + 1) });
    }
  }
}

export async function adjustStock(productId: string, delta: number, reason: string) {
  return getDb().transaction(async (tx) => {
    const now = new Date();
    const result = await tx.update(products).set({ stock: sql`${products.stock} + ${delta}`, updatedAt: now }).where(eq(products.id, productId));
    if (!result.rowsAffected) return false;
    await tx.insert(inventoryEvents).values({ id: crypto.randomUUID(), productId, quantityDelta: delta, reason, createdAt: now });
    return true;
  });
}

/** Historial de movimientos de un producto, con la referencia del pedido cuando aplica. */
export async function inventoryHistory(productId: string, limit = 100) {
  return getDb().select({ id: inventoryEvents.id, quantityDelta: inventoryEvents.quantityDelta, reason: inventoryEvents.reason, createdAt: inventoryEvents.createdAt, orderReference: orders.reference })
    .from(inventoryEvents).leftJoin(orders, eq(orders.id, inventoryEvents.orderId))
    .where(eq(inventoryEvents.productId, productId)).orderBy(desc(inventoryEvents.createdAt)).limit(limit);
}
