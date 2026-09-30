import { z } from "zod";
import { authorizeAdmin } from "@/lib/admin-auth";
import { manualPaymentMethodValues, orderStatuses, unpaidOrderStatuses, type OrderStatus } from "@/lib/commerce/constants";
import { notifyOrder } from "@/lib/commerce/notifications";
import { confirmManualPayment, getOrderDetail, getOrderForPayment, recordOrderEvent, transitionOrder, updateOrderNotes, updateOrderShipping } from "@/lib/commerce/orders";
import { getDb } from "@/db";
import { fail, handleError, noStore, ok, readBody } from "@/lib/http";
import { publicOrigin, wompiCheckoutUrl, wompiStatus } from "@/lib/payments/wompi";
import { storeConfig } from "@/lib/settings";

const uuid = z.string().uuid();
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), status: z.enum(orderStatuses.map((status) => status.value) as [OrderStatus, ...OrderStatus[]]), detail: z.string().trim().max(300).default("") }),
  z.object({ action: z.literal("manual_payment"), method: z.enum(manualPaymentMethodValues), note: z.string().trim().max(300).default("") }),
  z.object({ action: z.literal("notes"), internalNotes: z.string().max(4000) }),
  z.object({ action: z.literal("shipping"), shippingCop: z.coerce.number().int().min(0).max(100_000_000) }),
  z.object({ action: z.literal("payment_link") }),
]);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await authorizeAdmin(); if (admin instanceof Response) return admin;
  const { id } = await params;
  if (!uuid.safeParse(id).success) return fail("Pedido no válido.", 404);
  try {
    const detail = await getOrderDetail(id);
    if (!detail) return fail("El pedido no existe.", 404);
    const canEditShipping = unpaidOrderStatuses.includes(detail.order.status as OrderStatus);
    const config = await storeConfig();
    return Response.json({ ...detail, canEditShipping, paymentLinkAvailable: canEditShipping && wompiStatus().ready, config: { paymentInstructions: config.paymentInstructions, shippingNote: config.shippingNote } }, { headers: noStore });
  } catch (error) { return handleError(error, "admin_order_detail_failed", "No se pudo cargar el pedido."); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  const { id } = await params;
  if (!uuid.safeParse(id).success) return fail("Pedido no válido.", 404);
  const body = await readBody(request, schema, "Revisa la acción sobre el pedido."); if (body instanceof Response) return body;
  const origin = publicOrigin(request);
  try {
    if (body.action === "status") {
      await transitionOrder(id, body.status, admin.email, body.detail);
      if (body.status === "shipped") await notifyOrder("shipped", id, { origin, detail: body.detail }).catch((error) => console.error("order_notify_failed", error));
      return ok();
    }
    if (body.action === "manual_payment") {
      await confirmManualPayment(id, body, admin.email);
      await notifyOrder("paid", id, { origin }).catch((error) => console.error("order_notify_failed", error));
      return ok();
    }
    if (body.action === "shipping") { await updateOrderShipping(id, body.shippingCop * 100, admin.email); return ok(); }
    if (body.action === "payment_link") {
      if (!wompiStatus().ready) return fail("Wompi no está configurado: registra el pago manual cuando lo recibas.", 503);
      const order = await getOrderForPayment(id);
      if (!order) return fail("El pedido no existe.", 404);
      if (!unpaidOrderStatuses.includes(order.status as OrderStatus)) return fail("Este pedido ya tiene un pago confirmado o está cerrado.");
      const url = wompiCheckoutUrl({ reference: order.reference, amountInCents: order.totalInCents, redirectUrl: `${origin}/checkout/resultado?referencia=${encodeURIComponent(order.reference)}`, customer: { email: order.customerEmail, name: order.customerName, phone: order.customerPhone } });
      await recordOrderEvent(getDb(), id, "payment_link", `Enlace de pago generado por $${Math.round(order.totalInCents / 100).toLocaleString("es-CO")}.`, admin.email);
      return ok({ ok: true, url });
    }
    await updateOrderNotes(id, body.internalNotes);
    return ok();
  } catch (error) { return handleError(error, "admin_order_update_failed", "No se pudo actualizar el pedido."); }
}
