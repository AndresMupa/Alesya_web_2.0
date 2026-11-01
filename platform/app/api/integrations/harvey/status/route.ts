import { z } from "zod";
import { harveyAuthorized, recordHarveyContact } from "@/lib/crm/harvey";
import { handleError, noStore, readBody } from "@/lib/http";

const total = z.number().int().min(0).max(1_000_000);
const schema = z.object({
  prospects: total, verified: total, pendingVerification: total, risky: total, invalid: total,
  outboxPending: total, outboxApproved: total, sent: total,
  sendingPaused: z.boolean(),
  lastCycleAt: z.string().trim().max(40).nullable(),
});

/**
 * Resumen de la base local de Harvey al final de cada sincronización (solo conteos de los colegios que vinieron del CRM).
 * Lo muestra /admin/harvey: verificación de correos, correos esperando aprobación, envíos pausados y último ciclo.
 */
export async function POST(request: Request) {
  if (!harveyAuthorized(request)) return Response.json({ message: "No autorizado" }, { status: 401, headers: noStore });
  const body = await readBody(request, schema, "Resumen de Harvey inválido."); if (body instanceof Response) return body;
  try {
    await recordHarveyContact("status", body);
    return Response.json({ ok: true }, { headers: noStore });
  } catch (error) {
    return handleError(error, "harvey_status_failed", "No se pudo guardar el resumen de Harvey.");
  }
}
