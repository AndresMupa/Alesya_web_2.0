import "server-only";
import { and, count, desc, gte, inArray, lte, sql, sum } from "drizzle-orm";
import { getDb } from "@/db";
import { leads, orders, products } from "@/db/schema";
import { paidOrderStatuses } from "@/lib/statuses";

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;
const LOW_STOCK = 5;

/** Start of the current and previous month in Colombia (UTC-5, no daylight saving). */
function monthStarts(now = Date.now()) {
  const local = new Date(now - BOGOTA_OFFSET_MS);
  const current = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) + BOGOTA_OFFSET_MS;
  const previous = Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - 1, 1) + BOGOTA_OFFSET_MS;
  return { current: new Date(current), previous: new Date(previous) };
}

export type ActivityItem = { kind: "lead" | "order"; label: string; at: Date };

export async function getAdminSummary() {
  const db = getDb();
  const { current, previous } = monthStarts();
  const revenue = (from: Date, to?: Date) => db.select({ total: sum(orders.totalInCents), orders: count() }).from(orders)
    .where(and(inArray(orders.status, paidOrderStatuses), gte(orders.createdAt, from), to ? lte(orders.createdAt, to) : undefined));

  const [[month], [lastMonth], leadStages, orderStates, [productStats], recentLeads, recentOrders] = await Promise.all([
    revenue(current),
    revenue(previous, new Date(current.getTime() - 1)),
    db.select({ stage: leads.stage, total: count() }).from(leads).groupBy(leads.stage),
    db.select({ status: orders.status, total: count() }).from(orders).groupBy(orders.status),
    db.select({ active: sql<number>`sum(case when ${products.status} = 'active' then 1 else 0 end)`, lowStock: sql<number>`sum(case when ${products.status} = 'active' and ${products.stock} <= ${LOW_STOCK} then 1 else 0 end)` }).from(products),
    db.select({ name: leads.name, organization: leads.organization, at: leads.createdAt }).from(leads).orderBy(desc(leads.createdAt)).limit(6),
    db.select({ reference: orders.reference, customer: orders.customerName, status: orders.status, at: orders.updatedAt }).from(orders).orderBy(desc(orders.updatedAt)).limit(6),
  ]);

  const byStage = Object.fromEntries(leadStages.map((row) => [row.stage, row.total]));
  const byStatus = Object.fromEntries(orderStates.map((row) => [row.status, row.total]));
  const monthTotal = Number(month?.total ?? 0), lastTotal = Number(lastMonth?.total ?? 0);

  const activity: ActivityItem[] = [
    ...recentLeads.map((lead) => ({ kind: "lead" as const, label: `Nuevo contacto: ${lead.name} · ${lead.organization}`, at: lead.at })),
    ...recentOrders.map((order) => ({ kind: "order" as const, label: `Pedido ${order.reference} · ${order.customer}`, at: order.at, status: order.status })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 6);

  return {
    sales: { totalInCents: monthTotal, orders: Number(month?.orders ?? 0), changePct: lastTotal ? ((monthTotal - lastTotal) / lastTotal) * 100 : null },
    leads: { active: (byStage.new ?? 0) + (byStage.contacted ?? 0) + (byStage.proposal ?? 0), unattended: byStage.new ?? 0 },
    funnel: [["Nuevos", byStage.new ?? 0], ["Contactados", byStage.contacted ?? 0], ["Propuesta", byStage.proposal ?? 0], ["Ganados", byStage.won ?? 0]] as const,
    orders: { toPrepare: (byStatus.paid ?? 0) + (byStatus.preparing ?? 0), awaitingPayment: byStatus.payment_pending ?? 0, inReview: byStatus.payment_review ?? 0 },
    products: { active: Number(productStats?.active ?? 0), lowStock: Number(productStats?.lowStock ?? 0) },
    activity,
  };
}

export type AdminSummary = Awaited<ReturnType<typeof getAdminSummary>>;
