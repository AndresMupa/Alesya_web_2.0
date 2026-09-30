import { z } from "zod";
import { authorizeAdmin } from "@/lib/admin-auth";
import { actorName, contactChannels, outcomeValues } from "@/lib/crm/constants";
import { recordOutcome } from "@/lib/crm/leads";
import { fail, handleError, ok, readBody } from "@/lib/http";

const schema = z.object({
  outcome: z.enum(outcomeValues),
  channel: z.enum(contactChannels.map((channel) => channel.value) as ["whatsapp", "call", "email"]),
  note: z.string().trim().max(2000).default(""),
  nextFollowUp: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]).optional(),
  lostReason: z.string().trim().max(160).optional(),
  asesor: z.string().trim().max(80).optional(),
});

/** Resultado de una gestión de prospección: registra actividad, etapa y seguimiento en un paso. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("Contacto no válido.", 404);
  const body = await readBody(request, schema, "Revisa el resultado de la gestión."); if (body instanceof Response) return body;
  const { asesor, ...input } = body;
  try { return ok({ ok: true, ...await recordOutcome(id, input, actorName(admin.email, asesor)) }, 201); }
  catch (error) { return handleError(error, "crm_outcome_failed", "No se pudo registrar el resultado."); }
}
