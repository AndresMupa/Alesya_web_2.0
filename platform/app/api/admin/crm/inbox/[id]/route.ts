import { z } from "zod";
import { authorizeAdmin } from "@/lib/admin-auth";
import { releaseQuarantined } from "@/lib/crm/inbox";
import { handleError, ok, readBody } from "@/lib/http";

/** Saca un correo de la cuarentena del guardián y lo pasa a la captación; con `trustSender` el remitente queda como de confianza. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  const body = await readBody(request, z.object({ trustSender: z.boolean().default(false) })); if (body instanceof Response) return body;
  const { id } = await params;
  try { return ok(await releaseQuarantined(id, body)); }
  catch (error) { return handleError(error, "crm_inbox_release_failed", "No se pudo liberar el correo."); }
}
