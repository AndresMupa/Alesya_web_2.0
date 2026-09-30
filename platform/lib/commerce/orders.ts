import "server-only";
import { and, count, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { orderEvents, orderItems, orders, payments } from "@/db/schema";
import { resolveCart } from "@/lib/commerce/catalog";
import { manualOrderTransitions, orderQueues, orderStatusLabel, paymentMethodLabel, unpaidOrderStatuses, type OrderStatus } from "@/lib/commerce/constants";
import { moveOrderStock, type Tx } from "@/lib/commerce/inventory";
import { DomainError } from "@/lib/http";
import { storeConfig } from "@/lib/settings";

export const ORDERS_PAGE_SIZE = 30;

export type Customer = { name: string; email: string; phone: string; document?: string; city: string; address: string; notes?: string };
export type OrderOrigin = {
  /** Costo de envío en centavos. Si no se indica, se usa el valor por defecto de la configuración (0 = se coordina). */
  shippingInCents?: number;
  /** "web": lo hizo el cliente en la tienda; "admin": lo registró el equipo (venta por WhatsApp, colegio…). */
  channel?: "web" | "admin";
  actor?: string | null;
  internalNotes?: string;
};

export async function recordOrderEvent(tx: Tx | ReturnType<typeof getDb>, orderId: string, type: string, detail: string, actor: string | null = null, at = new Date()) {
  await tx.insert(orderEvents).values({ id: crypto.randomUUID(), orderId, type, detail, createdBy: actor, createdAt: at });
}

/**
 * Crea un pedido `payment_pending` a partir del carrito. Precios y stock salen de la base; si alguna
 * línea ya no se puede vender, se rechaza el pedido completo con un mensaje para el cliente.
 */
export async function createOrder(items: { slug: string; quantity: number }[], customer: Customer, provider: "wompi" | "manual", origin: OrderOrigin = {}) {
  const cart = await resolveCart(items);
  if (cart.missing.length) throw new DomainError("Uno de los productos del carrito ya no está disponible. Revisa el carrito.");
  const blocked = cart.lines.find((line) => line.problem);
  if (blocked) throw new DomainError(`${blocked.name}: ${blocked.problem?.toLowerCase()}. Ajusta la cantidad en el carrito.`);
  if (!cart.lines.length) throw new DomainError("El carrito está vacío.", 400);

  const db = getDb();
  const now = new Date();
  const orderId = crypto.randomUUID();
  const reference = `ALESYA-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const shippingInCents = origin.shippingInCents ?? (await storeConfig()).shippingDefaultInCents;
  const totalInCents = cart.subtotalInCents + shippingInCents;
  const summary = cart.lines.map((line) => `${line.quantity} × ${line.name}`).join(", ");
  const where = origin.channel === "admin" ? "Registrado desde el panel" : "Pedido desde la tienda";
  await db.batch([
    db.insert(orders).values({ id: orderId, reference, customerName: customer.name.trim(), customerEmail: customer.email.trim().toLowerCase(), customerPhone: customer.phone.trim(), customerDocument: customer.document?.trim() || null, shippingCity: customer.city.trim(), shippingAddress: customer.address.trim(), customerNotes: customer.notes?.trim() ?? "", internalNotes: origin.internalNotes?.trim() ?? "", subtotalInCents: cart.subtotalInCents, shippingInCents, totalInCents, status: "payment_pending", createdAt: now, updatedAt: now }),
    ...cart.lines.map((line) => db.insert(orderItems).values({ id: crypto.randomUUID(), orderId, productSlug: line.slug, productName: line.name, quantity: line.quantity, unitPriceInCents: line.priceInCents, lineTotalInCents: line.lineTotalInCents })),
    db.insert(payments).values({ id: crypto.randomUUID(), orderId, provider, reference, status: "pending", amountInCents: totalInCents, createdAt: now, updatedAt: now }),
    db.insert(orderEvents).values({ id: crypto.randomUUID(), orderId, type: "created", detail: `${where}: ${summary}. Envío: ${shippingInCents ? `$${Math.round(shippingInCents / 100).toLocaleString("es-CO")}` : "a coordinar"}. Pago: ${provider === "wompi" ? "Wompi" : "manual o enlace de pago"}.`, createdBy: origin.actor ?? null, createdAt: now }),
  ]);
  return { orderId, reference, totalInCents, shippingInCents, lines: cart.lines };
}

/** Cambia el costo de envío de un pedido sin pagar: actualiza el total y el monto del pago pendiente. */
export async function updateOrderShipping(id: string, shippingInCents: number, actor: string) {
  await getDb().transaction(async (tx) => {
    const [order] = await tx.select({ status: orders.status, subtotalInCents: orders.subtotalInCents, shippingInCents: orders.shippingInCents }).from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) throw new DomainError("El pedido no existe.", 404);
    if (!unpaidOrderStatuses.includes(order.status as OrderStatus)) throw new DomainError("El envío solo se puede cambiar antes de confirmar el pago.");
    const now = new Date();
    const totalInCents = order.subtotalInCents + shippingInCents;
    await tx.update(orders).set({ shippingInCents, totalInCents, updatedAt: now }).where(eq(orders.id, id));
    await tx.update(payments).set({ amountInCents: totalInCents, updatedAt: now }).where(and(eq(payments.orderId, id), eq(payments.status, "pending")));
    await recordOrderEvent(tx, id, "note", `Envío: ${shippingInCents ? `$${Math.round(shippingInCents / 100).toLocaleString("es-CO")}` : "sin costo / a coordinar"} (antes ${order.shippingInCents ? `$${Math.round(order.shippingInCents / 100).toLocaleString("es-CO")}` : "a coordinar"}). Total: $${Math.round(totalInCents / 100).toLocaleString("es-CO")}.`, actor, now);
  });
}

/** Datos mínimos para construir un enlace de pago o un mensaje al cliente. */
export async function getOrderForPayment(id: string) {
  const [order] = await getDb().select({ id: orders.id, reference: orders.reference, status: orders.status, totalInCents: orders.totalInCents, customerName: orders.customerName, customerEmail: orders.customerEmail, customerPhone: orders.customerPhone }).from(orders).where(eq(orders.id, id)).limit(1);
  return order ?? null;
}

export const orderCsvHeader = ["referencia", "fecha", "estado", "cliente", "correo", "celular", "documento", "ciudad", "direccion", "productos", "subtotal_cop", "envio_cop", "total_cop", "pago", "notas_cliente", "notas_internas"];

export async function exportOrders(filters: { queue?: string; search?: string }) {
  const db = getDb();
  const queue = orderQueues.find((item) => item.value === filters.queue) ?? orderQueues[4];
  const rows = await db.select().from(orders).where(queue.statuses.length ? inArray(orders.status, [...queue.statuses]) : undefined).orderBy(desc(orders.createdAt)).limit(10_000);
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const [items, paymentRows] = await Promise.all([
    db.select().from(orderItems).where(inArray(orderItems.orderId, ids)),
    db.select({ orderId: payments.orderId, provider: payments.provider, method: payments.method, status: payments.status }).from(payments).where(and(inArray(payments.orderId, ids), eq(payments.status, "approved"))),
  ]);
  const itemsByOrder = new Map<string, string[]>();
  for (const item of items) itemsByOrder.set(item.orderId, [...(itemsByOrder.get(item.orderId) ?? []), `${item.quantity} × ${item.productName}`]);
  const paymentByOrder = new Map(paymentRows.map((row) => [row.orderId, `${row.provider === "manual" ? "Manual" : "Wompi"} · ${paymentMethodLabel(row.method)}`]));
  return rows.map((order) => [
    order.reference, order.createdAt.toISOString().slice(0, 16).replace("T", " "), orderStatusLabel(order.status), order.customerName, order.customerEmail, order.customerPhone, order.customerDocument, order.shippingCity, order.shippingAddress,
    (itemsByOrder.get(order.id) ?? []).join("; "), Math.round(order.subtotalInCents / 100), Math.round(order.shippingInCents / 100), Math.round(order.totalInCents / 100), paymentByOrder.get(order.id) ?? "", order.customerNotes, order.internalNotes,
  ]);
}

// ── Bandeja del panel ────────────────────────────────────────────────────────

export async function listOrders(filters: { queue?: string; search?: string }, page = 1) {
  const db = getDb();
  const queue = orderQueues.find((item) => item.value === filters.queue) ?? orderQueues[0];
  const search = filters.search?.trim().slice(0, 80);
  const condition = and(
    queue.statuses.length ? inArray(orders.status, [...queue.statuses]) : undefined,
    search ? or(like(orders.reference, `%${search}%`), like(orders.customerName, `%${search}%`), like(orders.customerEmail, `%${search}%`), like(orders.customerPhone, `%${search}%`)) : undefined,
  );
  const [rows, [total], byStatus] = await Promise.all([
    db.select({ id: orders.id, reference: orders.reference, customerName: orders.customerName, customerEmail: orders.customerEmail, customerPhone: orders.customerPhone, shippingCity: orders.shippingCity, totalInCents: orders.totalInCents, status: orders.status, createdAt: orders.createdAt, updatedAt: orders.updatedAt, items: sql<number>`(select coalesce(sum(${orderItems.quantity}), 0) from ${orderItems} where ${orderItems.orderId} = ${orders.id})` })
      .from(orders).where(condition).orderBy(desc(orders.createdAt)).limit(ORDERS_PAGE_SIZE).offset((page - 1) * ORDERS_PAGE_SIZE),
    db.select({ value: count() }).from(orders).where(condition),
    db.select({ status: orders.status, total: count() }).from(orders).groupBy(orders.status),
  ]);
  const counts = Object.fromEntries(orderQueues.map((item) => [item.value, byStatus.filter((row) => !item.statuses.length || (item.statuses as readonly string[]).includes(row.status)).reduce((acc, row) => acc + row.total, 0)]));
  return { rows, total: total.value, page, pageSize: ORDERS_PAGE_SIZE, queue: queue.value, counts };
}

export async function getOrderDetail(id: string) {
  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return null;
  const [items, paymentRows, events] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, id)),
    db.select().from(payments).where(eq(payments.orderId, id)).orderBy(desc(payments.createdAt)),
    db.select().from(orderEvents).where(eq(orderEvents.orderId, id)).orderBy(desc(orderEvents.createdAt)).limit(100),
  ]);
  return { order, items, payments: paymentRows, events, transitions: manualOrderTransitions[order.status as OrderStatus] ?? [], canConfirmPayment: [...unpaidOrderStatuses, "payment_review"].includes(order.status as OrderStatus) };
}

/** Avanza la preparación (pagado → en preparación → enviado → entregado) o cancela un pedido sin pagar. */
export async function transitionOrder(id: string, next: OrderStatus, actor: string, detail = "") {
  await getDb().transaction(async (tx) => {
    const [order] = await tx.select({ status: orders.status }).from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) throw new DomainError("El pedido no existe.", 404);
    if (!manualOrderTransitions[order.status as OrderStatus]?.includes(next)) throw new DomainError("Ese cambio de estado no está permitido. Los pagos se confirman con Wompi o registrando un pago manual.");
    const now = new Date();
    const result = await tx.update(orders).set({ status: next, updatedAt: now }).where(and(eq(orders.id, id), eq(orders.status, order.status)));
    if (!result.rowsAffected) throw new DomainError("El pedido cambió mientras lo editabas. Actualiza e intenta de nuevo.");
    if (next === "cancelled") await tx.update(payments).set({ status: "cancelled", updatedAt: now }).where(and(eq(payments.orderId, id), eq(payments.status, "pending")));
    await recordOrderEvent(tx, id, "status", `${orderStatusLabel(order.status)} → ${orderStatusLabel(next)}${detail ? ` · ${detail}` : ""}`, actor, now);
  });
}

/**
 * Registra un pago recibido fuera de Wompi (transferencia, Nequi directo, efectivo, datáfono): el pedido
 * pasa a "pagado", se descuenta el inventario y los pagos Wompi pendientes quedan reemplazados.
 */
export async function confirmManualPayment(id: string, input: { method: string; note?: string }, actor: string) {
  await getDb().transaction(async (tx) => {
    const [order] = await tx.select({ status: orders.status, reference: orders.reference, totalInCents: orders.totalInCents }).from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) throw new DomainError("El pedido no existe.", 404);
    if (![...unpaidOrderStatuses, "payment_review"].includes(order.status as OrderStatus)) throw new DomainError("Este pedido ya tiene un pago confirmado o está cerrado.");
    const now = new Date();
    const result = await tx.update(orders).set({ status: "paid", updatedAt: now }).where(and(eq(orders.id, id), eq(orders.status, order.status)));
    if (!result.rowsAffected) throw new DomainError("El pedido cambió mientras lo editabas. Actualiza e intenta de nuevo.");
    await tx.update(payments).set({ status: "superseded", updatedAt: now }).where(and(eq(payments.orderId, id), inArray(payments.status, ["pending", "declined", "error", "review"])));
    const [{ total }] = await tx.select({ total: count() }).from(payments).where(eq(payments.orderId, id));
    await tx.insert(payments).values({ id: crypto.randomUUID(), orderId: id, provider: "manual", reference: `${order.reference}-M${total}`, method: input.method, status: "approved", amountInCents: order.totalInCents, createdAt: now, updatedAt: now });
    await moveOrderStock(tx, id, -1, "sale");
    await recordOrderEvent(tx, id, "manual_payment", `${paymentMethodLabel(input.method)}${input.note ? ` · ${input.note.trim()}` : ""}`, actor, now);
  });
}

export async function updateOrderNotes(id: string, internalNotes: string) {
  const result = await getDb().update(orders).set({ internalNotes: internalNotes.trim(), updatedAt: new Date() }).where(eq(orders.id, id));
  if (!result.rowsAffected) throw new DomainError("El pedido no existe.", 404);
}

/** Vista pública del resultado del pago: solo estado, productos y total (nunca datos de contacto). */
export async function findPublicOrder(reference?: string | null) {
  if (!reference || reference.length > 80) return null;
  const db = getDb();
  const [order] = await db.select({ id: orders.id, status: orders.status, totalInCents: orders.totalInCents, reference: orders.reference }).from(orders).where(eq(orders.reference, reference)).limit(1);
  if (!order) return null;
  const items = await db.select({ name: orderItems.productName, quantity: orderItems.quantity, lineTotalInCents: orderItems.lineTotalInCents }).from(orderItems).where(eq(orderItems.orderId, order.id));
  return { status: order.status, totalInCents: order.totalInCents, reference: order.reference, items };
}
