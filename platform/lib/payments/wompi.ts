import "server-only";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orders, payments } from "@/db/schema";
import { moveOrderStock } from "@/lib/commerce/inventory";
import { recordOrderEvent } from "@/lib/commerce/orders";

/** Adaptador de Wompi: firma del checkout, verificación del webhook y aplicación de transacciones. */

export function wompiStatus() {
  const ready = Boolean(process.env.WOMPI_PUBLIC_KEY && process.env.WOMPI_INTEGRITY_SECRET);
  return { ready, webhookReady: Boolean(process.env.WOMPI_EVENTS_SECRET), mode: process.env.WOMPI_PUBLIC_KEY?.startsWith("pub_prod_") ? "producción" as const : "sandbox" as const };
}

export function wompiCheckoutUrl(input: { reference: string; amountInCents: number; redirectUrl: string; customer: { email: string; name: string; phone: string } }) {
  const publicKey = process.env.WOMPI_PUBLIC_KEY, integritySecret = process.env.WOMPI_INTEGRITY_SECRET;
  if (!publicKey || !integritySecret) return null;
  const currency = "COP";
  const integrity = createHash("sha256").update(`${input.reference}${input.amountInCents}${currency}${integritySecret}`).digest("hex");
  const params = new URLSearchParams({
    "public-key": publicKey, currency, "amount-in-cents": String(input.amountInCents), reference: input.reference, "signature:integrity": integrity, "redirect-url": input.redirectUrl,
    "customer-data:email": input.customer.email, "customer-data:full-name": input.customer.name, "customer-data:phone-number": input.customer.phone,
  });
  return `https://checkout.wompi.co/p/?${params.toString()}`;
}

export type WompiEvent = { event?: string; data?: Record<string, unknown>; timestamp?: number; signature?: { properties?: string[]; checksum?: string } };

function readPath(root: unknown, path: string) { return path.split(".").reduce<unknown>((value, key) => value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined, root); }
function sameHash(a: string, b: string) { if (a.length !== b.length) return false; let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i); return diff === 0; }

/** `true` si el evento viene firmado con `WOMPI_EVENTS_SECRET`. */
export function verifyWompiEvent(body: WompiEvent | null, headerChecksum: string | null, secret: string) {
  const properties = body?.signature?.properties, checksum = headerChecksum ?? body?.signature?.checksum;
  if (!body?.data || !body.timestamp || !properties?.length || !checksum) return false;
  const signed = properties.map((path) => String(readPath(body.data, path) ?? "")).join("") + body.timestamp + secret;
  return sameHash(createHash("sha256").update(signed).digest("hex").toLowerCase(), checksum.toLowerCase());
}

// Estado de Wompi → [estado del pago, estado del pedido, evento del pedido].
const outcomes: Record<string, [string, string, string]> = {
  APPROVED: ["approved", "paid", "payment_approved"],
  DECLINED: ["declined", "payment_declined", "payment_declined"],
  VOIDED: ["voided", "payment_voided", "payment_voided"],
  ERROR: ["error", "payment_error", "payment_error"],
};
// Un pago solo avanza: pendiente se cierra una vez y una aprobación solo puede anularse.
const allowedFrom: Record<string, string[]> = { approved: ["pending"], declined: ["pending"], error: ["pending"], voided: ["pending", "approved"] };

/**
 * Aplica una transacción `transaction.updated`. Idempotente: eventos repetidos o fuera de orden se ignoran.
 * Una aprobación con monto o moneda distintos queda en revisión y no mueve inventario.
 */
export async function applyWompiTransaction(transaction: Record<string, unknown> | undefined) {
  const reference = String(transaction?.reference ?? ""), wompiStatusValue = String(transaction?.status ?? "").toUpperCase(), outcome = outcomes[wompiStatusValue];
  if (!reference || !outcome) return;
  const [paymentStatus, orderStatus, eventType] = outcome;
  const providerId = String(transaction?.id ?? ""), method = transaction?.payment_method_type ? String(transaction.payment_method_type) : null;

  await getDb().transaction(async (tx) => {
    const [payment] = await tx.select().from(payments).where(eq(payments.reference, reference)).limit(1);
    if (!payment) { console.warn("wompi_unknown_reference", reference); return; }
    const now = new Date();
    // El pedido ya se pagó a mano o se canceló: un cobro aprobado en Wompi no cambia el pedido, pero queda
    // registrado en revisión para devolver el dinero o reactivar el pedido.
    if ((payment.status === "superseded" || payment.status === "cancelled") && paymentStatus === "approved") {
      await tx.update(payments).set({ status: "review", providerTransactionId: providerId, method, updatedAt: now }).where(eq(payments.id, payment.id));
      await recordOrderEvent(tx, payment.orderId, "payment_review", payment.status === "cancelled" ? "Wompi aprobó un cobro de un pedido cancelado. Revisar devolución." : "Wompi aprobó un cobro de un pedido que ya tenía pago manual. Revisar posible doble pago.", null, now);
      return;
    }
    if (payment.status === paymentStatus || !allowedFrom[paymentStatus]?.includes(payment.status)) return;
    if (paymentStatus === "approved" && (Number(transaction?.amount_in_cents) !== payment.amountInCents || String(transaction?.currency ?? "COP") !== "COP")) {
      console.error("wompi_amount_mismatch", reference, transaction?.amount_in_cents, payment.amountInCents);
      await tx.update(payments).set({ status: "review", providerTransactionId: providerId, method, updatedAt: now }).where(eq(payments.id, payment.id));
      await tx.update(orders).set({ status: "payment_review", updatedAt: now }).where(eq(orders.id, payment.orderId));
      await recordOrderEvent(tx, payment.orderId, "payment_review", `Monto o moneda no coinciden (${String(transaction?.amount_in_cents)} ${String(transaction?.currency ?? "")}).`, null, now);
      return;
    }
    const updated = await tx.update(payments).set({ status: paymentStatus, providerTransactionId: providerId, method, updatedAt: now }).where(and(eq(payments.id, payment.id), eq(payments.status, payment.status)));
    if (!updated.rowsAffected) return;
    await tx.update(orders).set({ status: orderStatus, updatedAt: now }).where(eq(orders.id, payment.orderId));
    await recordOrderEvent(tx, payment.orderId, eventType, `Wompi ${wompiStatusValue}${method ? ` · ${method}` : ""}${providerId ? ` · ${providerId}` : ""}`, null, now);
    if (paymentStatus === "approved") await moveOrderStock(tx, payment.orderId, -1, "sale");
    if (paymentStatus === "voided" && payment.status === "approved") await moveOrderStock(tx, payment.orderId, 1, "payment_voided");
  });
}
