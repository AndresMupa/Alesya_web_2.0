import { z } from "zod";
import { authorizeAdmin } from "@/lib/admin-auth";
import { activityTypeValues, actorName } from "@/lib/crm/constants";
import { logActivity } from "@/lib/crm/leads";
import { fail, handleError, ok, readBody } from "@/lib/http";

const schema = z.object({
  type: z.enum(activityTypeValues),
  summary: z.string().trim().min(3).max(2000),
  nextFollowUp: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]).optional(),
  asesor: z.string().trim().max(80).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("Contacto no válido.", 404);
  const body = await readBody(request, schema, "Describe la gestión en al menos 3 caracteres."); if (body instanceof Response) return body;
  const { asesor, ...input } = body;
  try { await logActivity(id, input, actorName(admin.email, asesor)); return ok({ ok: true }, 201); }
  catch (error) { return handleError(error, "crm_activity_failed", "No se pudo registrar la gestión."); }
}
