import { z } from "zod";
import { authorizeAdmin } from "@/lib/admin-auth";
import { leadPriorityValues, manualLeadSources } from "@/lib/crm/constants";
import { createLead, leadFiltersFrom, listLeads } from "@/lib/crm/leads";
import { fail, handleError, noStore, ok, readBody } from "@/lib/http";

export async function GET(request: Request) {
  const admin = await authorizeAdmin(); if (admin instanceof Response) return admin;
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Math.min(10_000, Number.parseInt(params.get("page") ?? "1", 10) || 1));
  try { return Response.json(await listLeads(leadFiltersFrom(params), page), { headers: noStore }); }
  catch (error) { return handleError(error, "crm_leads_list_failed", "No se pudo cargar la base comercial."); }
}

const optional = (max: number) => z.string().trim().max(max).default("");
const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  organization: z.string().trim().min(2).max(160),
  email: z.union([z.string().trim().email().max(180), z.literal("")]).default(""),
  phone: optional(60), city: optional(100), website: optional(300), owner: optional(120),
  source: z.enum(manualLeadSources.map((source) => source.value) as [string, ...string[]]),
  priority: z.enum(leadPriorityValues).default("medium"),
  message: z.string().trim().min(8).max(2000),
  notes: optional(4000),
  estimatedValue: z.coerce.number().int().min(0).max(10_000_000_000).default(0),
  nextFollowUp: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).default(""),
});

export async function POST(request: Request) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  const body = await readBody(request, createSchema, "Revisa los datos del nuevo contacto."); if (body instanceof Response) return body;
  if (!body.email && !body.phone) return fail("Registra al menos un correo o un teléfono para poder hacer seguimiento.");
  try {
    const id = await createLead({ ...body, estimatedValueInCents: body.estimatedValue * 100, nextFollowUp: body.nextFollowUp || null }, { type: "created", actor: admin.email });
    return ok({ ok: true, id }, 201);
  } catch (error) { return handleError(error, "crm_lead_create_failed", "No se pudo crear la oportunidad."); }
}
