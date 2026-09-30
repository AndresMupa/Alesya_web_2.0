import { z } from "zod";
import { authorizeAdmin } from "@/lib/admin-auth";
import { actorName, leadPriorityValues } from "@/lib/crm/constants";
import { bulkUpdateLeads } from "@/lib/crm/leads";
import { handleError, ok, readBody } from "@/lib/http";

const schema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  owner: z.union([z.string().trim().max(120), z.null()]).optional(),
  priority: z.enum(leadPriorityValues).optional(),
  nextFollowUp: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]).optional(),
  asesor: z.string().trim().max(80).optional(),
});

/** Acciones masivas del CRM: asignar responsable, prioridad o programar seguimiento a varios contactos. */
export async function PATCH(request: Request) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  const body = await readBody(request, schema, "Selecciona contactos y un cambio para aplicar."); if (body instanceof Response) return body;
  const { ids, asesor, ...patch } = body;
  try { return ok({ ok: true, ...await bulkUpdateLeads(ids, patch, actorName(admin.email, asesor)) }); }
  catch (error) { return handleError(error, "crm_bulk_failed", "No se pudieron aplicar los cambios."); }
}
