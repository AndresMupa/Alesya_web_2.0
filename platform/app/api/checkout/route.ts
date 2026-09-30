import { z } from "zod";
import { cartItemsSchema } from "@/lib/commerce/catalog";
import { createOrder } from "@/lib/commerce/orders";
import { handleError, ok, readBody } from "@/lib/http";
import { wompiCheckoutUrl, wompiStatus } from "@/lib/payments/wompi";
import { enforceRateLimit } from "@/lib/rate-limit";

const checkoutSchema = z.object({
  items: cartItemsSchema.min(1),
  customer: z.object({
    name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(180), phone: z.string().trim().min(7).max(30),
    document: z.string().trim().max(30).optional(), city: z.string().trim().min(2).max(100), address: z.string().trim().min(5).max(240), notes: z.string().trim().max(1000).optional(),
  }),
});

/**
 * Crea el pedido con los precios y el stock de la base y, si Wompi está configurado, devuelve la URL firmada
 * del checkout. Sin Wompi, el pedido queda registrado para coordinar el pago con el equipo.
 */
export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, { name: "checkout", limit: 10, globalLimit: 200, windowMs: 15 * 60_000 });
  if (limited) return limited;
  const body = await readBody(request, checkoutSchema, "Los datos del pedido no están completos."); if (body instanceof Response) return body;
  const wompi = wompiStatus();
  try {
    const order = await createOrder(body.items, body.customer, wompi.ready ? "wompi" : "manual");
    const origin = new URL(request.url).origin;
    const checkoutUrl = wompi.ready ? wompiCheckoutUrl({ reference: order.reference, amountInCents: order.totalInCents, redirectUrl: `${origin}/checkout/resultado?referencia=${encodeURIComponent(order.reference)}`, customer: body.customer }) : null;
    return ok({ ok: true, orderReference: order.reference, totalInCents: order.totalInCents, checkoutUrl, resultUrl: `/checkout/resultado?referencia=${encodeURIComponent(order.reference)}` }, 201);
  } catch (error) { return handleError(error, "checkout_order_create_failed", "No fue posible registrar el pedido."); }
}
