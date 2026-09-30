import { z } from "zod";
import { cartItemsSchema, resolveCart } from "@/lib/commerce/catalog";
import { handleError, noStore, readBody } from "@/lib/http";

/** Devuelve el carrito con precios y disponibilidad actuales (el navegador solo guarda slugs y cantidades). */
export async function POST(request: Request) {
  const body = await readBody(request, z.object({ items: cartItemsSchema }), "Carrito no válido."); if (body instanceof Response) return body;
  try { return Response.json(await resolveCart(body.items), { headers: noStore }); }
  catch (error) { return handleError(error, "store_cart_failed", "No se pudo actualizar el carrito."); }
}
