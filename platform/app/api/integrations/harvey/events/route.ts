import { z } from "zod";
import { applyHarveyEvents, harveyAuthorized, harveyEventTypes } from "@/lib/crm/harvey";
import { handleError, noStore, readBody } from "@/lib/http";

const eventSchema = z.object({
  key: z.string().trim().min(1).max(200),
  type: z.enum(harveyEventTypes),
  leadId: z.string().trim().max(64).nullish(),
  email: z.string().trim().max(254).nullish(),
  at: z.string().trim().max(40).nullish(),
  subject: z.string().max(300).nullish(),
  step: z.number().int().min(1).max(20).nullish(),
  intent: z.string().trim().max(40).nullish(),
  excerpt: z.string().max(600).nullish(),
});
const schema = z.object({ events: z.array(eventSchema).min(1).max(200) });

/**
 * Lo que pasó en Harvey con cada colegio (entregado, envío, respuesta, reunión, baja, rebote, correo inválido).
 * Idempotente: reenviar un evento ya aplicado devuelve `duplicate` sin tocar la ficha.
 */
export async function POST(request: Request) {
  if (!harveyAuthorized(request)) return Response.json({ message: "No autorizado" }, { status: 401, headers: noStore });
  const body = await readBody(request, schema, "Eventos de Harvey inválidos."); if (body instanceof Response) return body;
  try {
    const results = await applyHarveyEvents(body.events);
    return Response.json({ results }, { headers: noStore });
  } catch (error) {
    return handleError(error, "harvey_events_failed", "No se pudieron aplicar los eventos.");
  }
}
