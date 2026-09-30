import "server-only";
import { and, asc, count, desc, eq, gte, inArray, lte, sql, sum } from "drizzle-orm";
import { getDb } from "@/db";
import { leads, orders, products } from "@/db/schema";
import { LOW_STOCK, paidOrderStatuses } from "@/lib/commerce/constants";
import { getAgenda, getSalesMetrics } from "@/lib/crm/leads";
import { bogotaMonthStart } from "@/lib/format";

export type ActivityItem = { kind: "lead" | "order"; label: string; at: Date; href: string };

/** Resumen del panel: ventas, embudo comercial, pedidos, inventario y actividad reciente. */
export async function getAdminSummary() {
  const db = getDb();
  const current = bogotaMonthStart(), previous = bogotaMonthStart(-1);
  const revenue = (from: Date, to?: Date) => db.select({ total: sum(orders.totalInCents), orders: count() }).from(orders)
    .where(and(inArray(orders.status, paidOrderStatuses), gte(orders.createdAt, from), to ? lte(orders.createdAt, to) : undefined));

  const [[month], [lastMonth], leadStages, orderStates, [productStats], lowStock, recentLeads, recentOrders, sales, agenda] = await Promise.all([
    revenue(current),
    revenue(previous, new Date(current.getTime() - 1)),
    db.select({ stage: leads.stage, total: count() }).from(leads).groupBy(leads.stage),
    db.select({ status: orders.status, total: count() }).from(orders).groupBy(orders.status),
    db.select({
      active: sql<number>`sum(case when ${products.status} = 'active' then 1 else 0 end)`,
      drafts: sql<number>`sum(case when ${products.status} = 'draft' then 1 else 0 end)`,
      noPrice: sql<number>`sum(case when ${products.status} <> 'archived' and ${products.priceInCents} <= 0 then 1 else 0 end)`,
      lowStock: sql<number>`sum(case when ${products.status} = 'active' and ${products.backorder} = 0 and ${products.stock} <= ${LOW_STOCK} then 1 else 0 end)`,
    }).from(products),
    db.select({ id: products.id, name: products.name, sku: products.sku, stock: products.stock }).from(products)
      .where(and(eq(products.status, "active"), eq(products.backorder, false), lte(products.stock, LOW_STOCK))).orderBy(asc(products.stock)).limit(6),
    db.select({ id: leads.id, name: leads.name, organization: leads.organization, at: leads.createdAt }).from(leads).where(sql`${leads.source} not like 'base_colegios_2026%'`).orderBy(desc(leads.createdAt)).limit(6),
    db.select({ id: orders.id, reference: orders.reference, customer: orders.customerName, at: orders.updatedAt }).from(orders).orderBy(desc(orders.updatedAt)).limit(6),
    getSalesMetrics(),
    getAgenda(6),
  ]);

  const byStage = Object.fromEntries(leadStages.map((row) => [row.stage, row.total]));
  const byStatus = Object.fromEntries(orderStates.map((row) => [row.status, row.total]));
  const monthTotal = Number(month?.total ?? 0), lastTotal = Number(lastMonth?.total ?? 0);

  const activity: ActivityItem[] = [
    ...recentLeads.map((lead) => ({ kind: "lead" as const, label: `Nuevo contacto: ${lead.name} · ${lead.organization}`, at: lead.at, href: `/admin/crm?lead=${lead.id}` })),
    ...recentOrders.map((order) => ({ kind: "order" as const, label: `Pedido ${order.reference} · ${order.customer}`, at: order.at, href: `/admin/pedidos?pedido=${order.id}` })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 6);

  return {
    sales: { totalInCents: monthTotal, orders: Number(month?.orders ?? 0), changePct: lastTotal ? ((monthTotal - lastTotal) / lastTotal) * 100 : null },
    crm: sales,
    funnel: [["Nuevos", byStage.new ?? 0], ["Contactados", byStage.contacted ?? 0], ["Reunión", byStage.meeting ?? 0], ["Propuesta", byStage.proposal ?? 0], ["Ganados", byStage.won ?? 0]] as const,
    orders: { toPrepare: (byStatus.paid ?? 0) + (byStatus.preparing ?? 0), awaitingPayment: byStatus.payment_pending ?? 0, inReview: byStatus.payment_review ?? 0 },
    products: { active: Number(productStats?.active ?? 0), drafts: Number(productStats?.drafts ?? 0), noPrice: Number(productStats?.noPrice ?? 0), lowStock: Number(productStats?.lowStock ?? 0), lowStockItems: lowStock },
    agenda,
    activity,
  };
}

export type AdminSummary = Awaited<ReturnType<typeof getAdminSummary>>;
