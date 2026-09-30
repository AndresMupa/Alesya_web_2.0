import "server-only";
import { and, count, desc, eq, gte, inArray, sql, sum } from "drizzle-orm";
import { getDb } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { paidOrderStatuses } from "@/lib/commerce/constants";

const DAY = 86_400_000;
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;
const WEEKS = 8;

/** Lunes (00:00 Bogotá) de la semana a la que pertenece un instante, como `YYYY-MM-DD`. */
function weekStart(at: Date) {
  const local = new Date(at.getTime() - BOGOTA_OFFSET_MS);
  const monday = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - ((local.getUTCDay() + 6) % 7)));
  return monday.toISOString().slice(0, 10);
}

/** Ventas por semana (8 semanas), productos más vendidos (30 días) y pedidos por estado. */
export async function getCommerceStats() {
  const db = getDb();
  const since = new Date(Date.now() - (WEEKS * 7 + 7) * DAY);
  const monthAgo = new Date(Date.now() - 30 * DAY);
  const [paidOrders, topProducts, byStatus] = await Promise.all([
    db.select({ createdAt: orders.createdAt, totalInCents: orders.totalInCents }).from(orders).where(and(inArray(orders.status, paidOrderStatuses), gte(orders.createdAt, since))),
    db.select({ slug: orderItems.productSlug, name: orderItems.productName, units: sum(orderItems.quantity), revenue: sum(orderItems.lineTotalInCents), orders: count() })
      .from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(inArray(orders.status, paidOrderStatuses), gte(orders.createdAt, monthAgo)))
      .groupBy(orderItems.productSlug, orderItems.productName).orderBy(desc(sum(orderItems.lineTotalInCents))).limit(6),
    db.select({ status: orders.status, total: count(), value: sql<number>`sum(${orders.totalInCents})` }).from(orders).groupBy(orders.status),
  ]);

  // Semanas completas, incluida la actual, con cero donde no hubo ventas.
  const currentWeek = weekStart(new Date());
  const weeks = Array.from({ length: WEEKS }, (_, index) => weekStart(new Date(Date.parse(`${currentWeek}T05:00:00Z`) - (WEEKS - 1 - index) * 7 * DAY)));
  const buckets = new Map(weeks.map((week) => [week, { week, revenueInCents: 0, orders: 0 }]));
  for (const order of paidOrders) {
    const bucket = buckets.get(weekStart(order.createdAt));
    if (bucket) { bucket.revenueInCents += order.totalInCents; bucket.orders += 1; }
  }
  return {
    revenueByWeek: Array.from(buckets.values()),
    topProducts: topProducts.map((row) => ({ slug: row.slug, name: row.name, units: Number(row.units ?? 0), revenueInCents: Number(row.revenue ?? 0), orders: row.orders })),
    byStatus: byStatus.map((row) => ({ status: row.status, total: row.total, valueInCents: Number(row.value ?? 0) })),
  };
}

export type CommerceStats = Awaited<ReturnType<typeof getCommerceStats>>;
