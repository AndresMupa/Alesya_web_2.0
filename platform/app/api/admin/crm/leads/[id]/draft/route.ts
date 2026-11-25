import { z } from "zod";
import { authorizeAdmin } from "@/lib/admin-auth";
import { draftMessage } from "@/lib/crm/ai-draft";
import { fail, handleError, ok, readBody } from "@/lib/http";

const schema = z.object({
  channel: z.enum(["whatsapp", "email"]),
  asesor: z.string().trim().max(80).optional(),
  instruccion: z.string().trim().max(500).optional(),
});

/** Genera un borrador de WhatsApp o correo con IA para una oportunidad. No envía nada. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("Contacto no válido.", 404);
  const body = await readBody(request, schema, "Revisa los datos del borrador."); if (body instanceof Response) return body;
  try { return ok({ ok: true, ...await draftMessage(id, body) }); }
  catch (error) { return handleError(error, "crm_ai_draft_failed", "No se pudo generar el borrador con IA."); }
}
