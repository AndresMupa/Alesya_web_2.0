import { z } from "zod";
import { authorizeAdmin } from "@/lib/admin-auth";
import { reorderProducts } from "@/lib/commerce/products";
import { handleError, ok, readBody } from "@/lib/http";

const schema = z.object({ items: z.array(z.object({ id: z.string().uuid(), position: z.coerce.number().int().min(0), category: z.string().trim().min(2).max(80) })).min(1).max(2000) });

export async function PATCH(request: Request) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  const body = await readBody(request, schema, "Orden no válido."); if (body instanceof Response) return body;
  try { await reorderProducts(body.items); return ok(); }
  catch (error) { return handleError(error, "admin_product_reorder_failed", "No se pudo guardar el nuevo orden."); }
}
