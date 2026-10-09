import { z } from "zod";
import { authorizeAdmin } from "@/lib/admin-auth";
import { getInboxOverview, syncInbox } from "@/lib/crm/inbox";
import { fail, handleError, noStore, ok, readBody } from "@/lib/http";

/** Captación por correo: estado del buzón, última revisión y los últimos correos revisados. */
export async function GET() {
  const admin = await authorizeAdmin(); if (admin instanceof Response) return admin;
  try { return Response.json(await getInboxOverview(), { headers: noStore }); }
  catch (error) { return handleError(error, "crm_inbox_read_failed", "No se pudo leer la captación por correo."); }
}

/** Revisa el buzón ahora. Con `ifStale` solo si la última revisión tiene más de 5 minutos (al abrir la máquina de ventas). */
export async function POST(request: Request) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  const body = await readBody(request, z.object({ ifStale: z.boolean().default(false) })); if (body instanceof Response) return body;
  try {
    const result = await syncInbox(body.ifStale ? { ifOlderThanMinutes: 5 } : {});
    if (!result) return fail("El buzón no está configurado: define IMAP_USER e IMAP_PASS en el servidor.", 409);
    return result.ok ? ok(result) : Response.json({ ...result, message: result.error }, { status: 502, headers: noStore });
  } catch (error) { return handleError(error, "crm_inbox_sync_failed", "No se pudo revisar el buzón."); }
}
