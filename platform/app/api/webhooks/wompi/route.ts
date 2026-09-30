import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orders, payments } from "@/db/schema";
import { moveOrderStock } from "@/lib/inventory";

type EventBody = { event?: string; data?: Record<string, unknown>; timestamp?: number; signature?: { properties?: string[]; checksum?: string } };
function readPath(root: unknown, path: string) { return path.split(".").reduce<unknown>((value, key) => value && typeof value === "object" ? (value as Record<string,unknown>)[key] : undefined, root); }
function sameHash(a: string, b: string) { if (a.length !== b.length) return false; let diff=0; for(let i=0;i<a.length;i++) diff |= a.charCodeAt(i)^b.charCodeAt(i); return diff===0; }

// Wompi transaction status → [payment status, order status].
const outcomes: Record<string, [string, string]> = {
  APPROVED: ["approved", "paid"],
  DECLINED: ["declined", "payment_declined"],
  VOIDED: ["voided", "payment_voided"],
  ERROR: ["error", "payment_error"],
};
// A payment only moves forward: pending closes once, and an approval can only be voided.
const allowedFrom: Record<string, string[]> = { approved: ["pending"], declined: ["pending"], error: ["pending"], voided: ["pending", "approved"] };

export async function POST(request: Request) {
  const secret = process.env.WOMPI_EVENTS_SECRET;
  if (!secret) return Response.json({ message:"Webhook no configurado" }, { status:503 });
  const body = await request.json().catch(() => null) as EventBody | null, properties = body?.signature?.properties, checksum = request.headers.get("x-event-checksum") ?? body?.signature?.checksum;
  if (!body?.data || !body.timestamp || !properties?.length || !checksum) return Response.json({ message:"Evento inválido" }, { status:400 });
  const signed = properties.map((path) => String(readPath(body.data, path) ?? "")).join("") + body.timestamp + secret, expected = createHash("sha256").update(signed).digest("hex");
  if (!sameHash(expected.toLowerCase(), checksum.toLowerCase())) return Response.json({ message:"Firma inválida" }, { status:401 });
  if (body.event !== "transaction.updated") return Response.json({ ok:true });

  const transaction = body.data.transaction as Record<string,unknown> | undefined;
  const reference = String(transaction?.reference ?? ""), wompiStatus = String(transaction?.status ?? "").toUpperCase(), outcome = outcomes[wompiStatus];
  if (!reference || !outcome) return Response.json({ ok:true });
  const [paymentStatus, orderStatus] = outcome;
  const providerId = String(transaction?.id ?? ""), method = transaction?.payment_method_type ? String(transaction.payment_method_type) : null;

  try {
    await getDb().transaction(async (tx) => {
      const [payment] = await tx.select().from(payments).where(eq(payments.reference, reference)).limit(1);
      if (!payment) { console.warn("wompi_unknown_reference", reference); return; }
      if (payment.status === paymentStatus || !allowedFrom[paymentStatus]?.includes(payment.status)) return;
      const now = new Date();
      if (paymentStatus === "approved" && (Number(transaction?.amount_in_cents) !== payment.amountInCents || String(transaction?.currency ?? "COP") !== "COP")) {
        console.error("wompi_amount_mismatch", reference, transaction?.amount_in_cents, payment.amountInCents);
        await tx.update(payments).set({ status:"review", providerTransactionId:providerId, method, updatedAt:now }).where(eq(payments.id, payment.id));
        await tx.update(orders).set({ status:"payment_review", updatedAt:now }).where(eq(orders.id, payment.orderId));
        return;
      }
      const updated = await tx.update(payments).set({ status:paymentStatus, providerTransactionId:providerId, method, updatedAt:now }).where(and(eq(payments.id, payment.id), eq(payments.status, payment.status)));
      if (!updated.rowsAffected) return;
      await tx.update(orders).set({ status:orderStatus, updatedAt:now }).where(eq(orders.id, payment.orderId));
      if (paymentStatus === "approved") await moveOrderStock(tx, payment.orderId, -1, "sale");
      if (paymentStatus === "voided" && payment.status === "approved") await moveOrderStock(tx, payment.orderId, 1, "payment_voided");
    });
  } catch (error) {
    console.error("wompi_event_failed", reference, error);
    return Response.json({ message:"No se pudo procesar el evento" }, { status:500 });
  }
  return Response.json({ ok:true });
}
