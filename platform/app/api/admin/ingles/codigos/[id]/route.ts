import { z } from "zod";
import { authorizeAdmin } from "@/lib/admin-auth";
import { setCodeActive } from "@/lib/english/access";
import { handleError, ok, readBody } from "@/lib/http";

/** Activa o desactiva un código. Desactivarlo corta el acceso de inmediato en todos los equipos que lo usaron. */
export async function PATCH(request: Request, { params }: RouteContext<"/api/admin/ingles/codigos/[id]">) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  const body = await readBody(request, z.object({ active: z.boolean() })); if (body instanceof Response) return body;
  try { await setCodeActive((await params).id, body.active); return ok(); }
  catch (error) { return handleError(error, "english_code_toggle_failed", "No se pudo actualizar el código."); }
}
