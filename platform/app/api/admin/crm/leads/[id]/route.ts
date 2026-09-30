import { z } from "zod";
import { authorizeAdmin } from "@/lib/admin-auth";
import { leadPriorityValues, leadStageValues } from "@/lib/crm/constants";
import { getLeadDetail, updateLead } from "@/lib/crm/leads";
import { fail, handleError, noStore, ok, readBody } from "@/lib/http";

const uuid = z.string().uuid();
const day = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]);
const nullableText = (max: number) => z.union([z.string().trim().max(max), z.null()]);

const patchSchema = z.object({
  name: z.string().trim().min(2).max(120), organization: z.string().trim().min(2).max(160),
  email: z.union([z.string().trim().email().max(180), z.literal(""), z.null()]).transform((value) => value || null),
  phone: nullableText(60), city: nullableText(100), website: nullableText(300), owner: nullableText(120),
  priority: z.enum(leadPriorityValues), stage: z.enum(leadStageValues), notes: z.string().trim().max(4000),
  lastContact: day, nextFollowUp: day, estimatedValue: z.coerce.number().int().min(0).max(10_000_000_000), lostReason: nullableText(160),
}).partial().refine((value) => Object.keys(value).length > 0);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await authorizeAdmin(); if (admin instanceof Response) return admin;
  const { id } = await params;
  if (!uuid.safeParse(id).success) return fail("Contacto no válido.", 404);
  try {
    const detail = await getLeadDetail(id);
    return detail ? Response.json(detail, { headers: noStore }) : fail("El contacto no existe.", 404);
  } catch (error) { return handleError(error, "crm_lead_detail_failed", "No se pudo cargar el contacto."); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  const { id } = await params;
  if (!uuid.safeParse(id).success) return fail("Contacto no válido.", 404);
  const body = await readBody(request, patchSchema, "Revisa los datos del contacto."); if (body instanceof Response) return body;
  const { estimatedValue, ...patch } = body;
  try {
    const lead = await updateLead(id, { ...patch, ...(estimatedValue !== undefined && { estimatedValueInCents: estimatedValue * 100 }) }, admin.email);
    return ok({ ok: true, lead });
  } catch (error) { return handleError(error, "crm_lead_update_failed", "No se pudo actualizar la oportunidad."); }
}
