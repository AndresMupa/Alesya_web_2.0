import { z } from "zod";
import { decideQuoteByToken } from "@/lib/crm/quotes";
import { fail, handleError, ok, readBody } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

const schema = z.object({ decision: z.enum(["accepted", "rejected"]), note: z.string().trim().max(500).default("") });

/** El colegio acepta o rechaza la cotización desde el enlace público. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const limited = await enforceRateLimit(request, { name: "quote-decision", limit: 10, globalLimit: 200, windowMs: 15 * 60_000 });
  if (limited) return limited;
  const { token } = await params;
  if (!/^[a-f0-9]{32}$/.test(token)) return fail("Cotización no válida.", 404);
  const body = await readBody(request, schema, "Indica si aceptas o rechazas la cotización."); if (body instanceof Response) return body;
  try { return ok({ ok: true, ...await decideQuoteByToken(token, body.decision, body.note) }); }
  catch (error) { return handleError(error, "quote_decision_failed", "No se pudo registrar tu respuesta."); }
}
