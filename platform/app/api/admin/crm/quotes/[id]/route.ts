import { z } from "zod";
import { authorizeAdmin } from "@/lib/admin-auth";
import { actorName } from "@/lib/crm/constants";
import { getQuote, setQuoteStatus, updateQuote } from "@/lib/crm/quotes";
import { fail, handleError, noStore, ok, readBody } from "@/lib/http";

const itemSchema = z.object({ description: z.string().trim().min(2).max(200), quantity: z.coerce.number().min(0.5).max(10_000), unitPriceInCents: z.coerce.number().int().min(0).max(1_000_000_000_00), productSlug: z.string().trim().max(200).nullable().optional() });
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("update"), title: z.string().trim().min(3).max(160).optional(), items: z.array(itemSchema).min(1).max(60).optional(), discountInCents: z.coerce.number().int().min(0).optional(), validUntil: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]).optional(), notes: z.string().trim().max(2000).optional(), terms: z.string().trim().max(2000).optional(), asesor: z.string().trim().max(80).optional() }),
  z.object({ action: z.literal("status"), status: z.enum(["sent", "accepted", "rejected", "expired"]), note: z.string().trim().max(500).default(""), asesor: z.string().trim().max(80).optional() }),
]);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await authorizeAdmin(); if (admin instanceof Response) return admin;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("Cotización no válida.", 404);
  try { const quote = await getQuote(id); return quote ? Response.json(quote, { headers: noStore }) : fail("La cotización no existe.", 404); }
  catch (error) { return handleError(error, "crm_quote_detail_failed", "No se pudo cargar la cotización."); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("Cotización no válida.", 404);
  const body = await readBody(request, schema, "Revisa los datos de la cotización."); if (body instanceof Response) return body;
  const actor = actorName(admin.email, body.asesor);
  try {
    if (body.action === "status") return ok({ ok: true, ...await setQuoteStatus(id, body.status, actor, body.note) });
    const { action, asesor, ...input } = body; void action; void asesor;
    await updateQuote(id, input, actor);
    return ok();
  } catch (error) { return handleError(error, "crm_quote_update_failed", "No se pudo actualizar la cotización."); }
}
