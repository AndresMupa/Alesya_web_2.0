import { z } from "zod";
import { cartItemsSchema, resolveCart } from "@/lib/commerce/catalog";
import { handleError, noStore, readBody } from "@/lib/http";
import { storeConfig } from "@/lib/settings";

/** Devuelve el carrito con precios y disponibilidad actuales (el navegador solo guarda slugs y cantidades). */
export async function POST(request: Request) {
  const body = await readBody(request, z.object({ items: cartItemsSchema }), "Carrito no válido."); if (body instanceof Response) return body;
  try {
    const [cart, config] = await Promise.all([resolveCart(body.items), storeConfig()]);
    return Response.json({ ...cart, shippingInCents: config.shippingDefaultInCents, shippingNote: config.shippingNote }, { headers: noStore });
  }
  catch (error) { return handleError(error, "store_cart_failed", "No se pudo actualizar el carrito."); }
}
