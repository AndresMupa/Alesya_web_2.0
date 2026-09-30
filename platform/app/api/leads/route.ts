import { z } from "zod";
import { campaignChannels } from "@/lib/crm/constants";
import { createLead } from "@/lib/crm/leads";
import { notifyNewLead } from "@/lib/commerce/notifications";
import { handleError, ok, readBody } from "@/lib/http";
import { publicOrigin } from "@/lib/payments/wompi";
import { enforceRateLimit } from "@/lib/rate-limit";

const leadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  organization: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(180),
  phone: z.string().trim().max(30).optional().transform((value) => value || undefined),
  message: z.string().trim().min(8).max(2000),
  source: z.enum(["website", ...campaignChannels]).default("website"),
  campaign: z.string().trim().regex(/^[a-zA-Z0-9_-]{0,40}$/).default(""),
});

/** Formularios públicos (portada, colegios): cada envío entra al CRM como oportunidad nueva. */
export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, { name: "lead", limit: 5, globalLimit: 100, windowMs: 15 * 60_000 });
  if (limited) return limited;
  const body = await readBody(request, leadSchema, "Revisa los datos del formulario."); if (body instanceof Response) return body;
  const { source, campaign, ...contact } = body;
  try {
    const fullSource = campaign ? `${source} / ${campaign}` : source;
    const id = await createLead({ ...contact, source: fullSource, priority: "high" }, { type: "form" });
    await notifyNewLead({ id, ...contact, source: fullSource }, publicOrigin(request)).catch((error) => console.error("lead_notify_failed", error));
    return ok({ ok: true }, 201);
  } catch (error) { return handleError(error, "lead_create_failed", "El CRM no está disponible temporalmente."); }
}
