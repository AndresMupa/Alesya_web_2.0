import { z } from "zod";
import { authorizeAdmin } from "@/lib/admin-auth";
import { bulkUpdateProducts } from "@/lib/commerce/products";
import { handleError, ok, readBody } from "@/lib/http";

const schema = z.object({ ids: z.array(z.string().uuid()).min(1).max(2000), action: z.enum(["publish", "draft", "archive", "feature", "unfeature"]) });

export async function POST(request: Request) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  const body = await readBody(request, schema, "Selecciona productos y una acción."); if (body instanceof Response) return body;
  try { return ok({ ok: true, ...await bulkUpdateProducts(body.ids, body.action) }); }
  catch (error) { return handleError(error, "admin_product_bulk_failed", "No se pudo aplicar la acción."); }
}
