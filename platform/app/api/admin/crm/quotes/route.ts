import { z } from "zod";
import { authorizeAdmin } from "@/lib/admin-auth";
import { actorName } from "@/lib/crm/constants";
import { createQuote, listQuotes } from "@/lib/crm/quotes";
import { handleError, noStore, ok, readBody } from "@/lib/http";

const quoteItemSchema = z.object({ description: z.string().trim().min(2).max(200), quantity: z.coerce.number().min(0.5).max(10_000), unitPriceInCents: z.coerce.number().int().min(0).max(1_000_000_000_00), productSlug: z.string().trim().max(200).nullable().optional() });
const createSchema = z.object({
  leadId: z.string().uuid(), title: z.string().trim().min(3).max(160), items: z.array(quoteItemSchema).min(1).max(60),
  discountInCents: z.coerce.number().int().min(0).max(1_000_000_000_00).default(0), validUntil: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]).optional(),
  notes: z.string().trim().max(2000).default(""), terms: z.string().trim().max(2000).default(""), asesor: z.string().trim().max(80).optional(),
});

export async function GET(request: Request) {
  const admin = await authorizeAdmin(); if (admin instanceof Response) return admin;
  const params = new URL(request.url).searchParams;
  try { return Response.json(await listQuotes({ status: params.get("status") ?? undefined, search: params.get("search") ?? undefined }), { headers: noStore }); }
  catch (error) { return handleError(error, "crm_quotes_list_failed", "No se pudieron cargar las cotizaciones."); }
}

export async function POST(request: Request) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  const body = await readBody(request, createSchema, "Revisa el título y los renglones de la cotización."); if (body instanceof Response) return body;
  const { leadId, asesor, ...input } = body;
  try { return ok({ ok: true, ...await createQuote(leadId, input, actorName(admin.email, asesor)) }, 201); }
  catch (error) { return handleError(error, "crm_quote_create_failed", "No se pudo crear la cotización."); }
}
