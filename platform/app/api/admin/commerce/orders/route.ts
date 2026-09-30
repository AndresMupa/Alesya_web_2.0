import { z } from "zod";
import { authorizeAdmin } from "@/lib/admin-auth";
import { cartItemsSchema } from "@/lib/commerce/catalog";
import { notifyOrder } from "@/lib/commerce/notifications";
import { createOrder, listOrders } from "@/lib/commerce/orders";
import { actorName } from "@/lib/crm/constants";
import { handleError, noStore, ok, readBody } from "@/lib/http";
import { publicOrigin, wompiCheckoutUrl, wompiStatus } from "@/lib/payments/wompi";

export async function GET(request: Request) {
  const admin = await authorizeAdmin(); if (admin instanceof Response) return admin;
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Math.min(10_000, Number.parseInt(params.get("page") ?? "1", 10) || 1));
  try { return Response.json(await listOrders({ queue: params.get("queue") ?? undefined, search: params.get("search") ?? undefined }, page), { headers: noStore }); }
  catch (error) { return handleError(error, "admin_orders_list_failed", "No se pudieron cargar los pedidos."); }
}

const createSchema = z.object({
  items: cartItemsSchema.min(1),
  customer: z.object({
    name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(180), phone: z.string().trim().min(7).max(30),
    document: z.string().trim().max(30).optional(), city: z.string().trim().min(2).max(100), address: z.string().trim().min(3).max(240), notes: z.string().trim().max(1000).optional(),
  }),
  shippingCop: z.coerce.number().int().min(0).max(100_000_000).default(0),
  internalNotes: z.string().trim().max(4000).default(""),
  sendEmail: z.boolean().default(true),
  asesor: z.string().trim().max(80).optional(),
});

/**
 * Pedido registrado desde el panel (venta por WhatsApp, colegio, feria). Queda pendiente de pago: el equipo
 * envía el enlace de Wompi o registra el pago manual cuando llegue. Si hay correo, el cliente recibe el resumen.
 */
export async function POST(request: Request) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  const body = await readBody(request, createSchema, "Revisa los productos y los datos del cliente."); if (body instanceof Response) return body;
  const origin = publicOrigin(request);
  const wompi = wompiStatus();
  try {
    const order = await createOrder(body.items, body.customer, wompi.ready ? "wompi" : "manual", { channel: "admin", shippingInCents: body.shippingCop * 100, internalNotes: body.internalNotes, actor: actorName(admin.email, body.asesor) });
    const checkoutUrl = wompi.ready ? wompiCheckoutUrl({ reference: order.reference, amountInCents: order.totalInCents, redirectUrl: `${origin}/checkout/resultado?referencia=${encodeURIComponent(order.reference)}`, customer: body.customer }) : null;
    if (body.sendEmail) await notifyOrder("received", order.orderId, { origin, checkoutUrl }).catch((error) => console.error("order_notify_failed", error));
    return ok({ ok: true, id: order.orderId, reference: order.reference, totalInCents: order.totalInCents, checkoutUrl }, 201);
  } catch (error) { return handleError(error, "admin_order_create_failed", "No se pudo registrar el pedido."); }
}
