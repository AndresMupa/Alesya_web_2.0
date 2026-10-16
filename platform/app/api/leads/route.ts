import { after } from "next/server";
import { z } from "zod";
import { formLeadSources } from "@/lib/crm/constants";
import { createLead } from "@/lib/crm/leads";
import { gradeLevels } from "@/lib/crm/score";
import { notifyNewLead, sendLeadAutoReply } from "@/lib/commerce/notifications";
import { handleError, ok, readBody } from "@/lib/http";
import { publicOrigin } from "@/lib/payments/wompi";
import { enforceRateLimit } from "@/lib/rate-limit";

const gradeValues = gradeLevels.map((level) => level.value) as [string, ...string[]];

const leadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  organization: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(180),
  phone: z.string().trim().max(30).optional().transform((value) => value || undefined),
  message: z.string().trim().min(8).max(2000),
  source: z.enum(formLeadSources).default("website"),
  campaign: z.string().trim().regex(/^[a-zA-Z0-9_-]{0,40}$/).default(""),
  /** Calificación opcional: niveles de interés, estudiantes aproximados y el programa de la página. */
  grades: z.array(z.enum(gradeValues)).max(gradeValues.length).default([]),
  students: z.coerce.number().int().min(0).max(50_000).default(0),
  program: z.string().trim().max(80).optional().transform((value) => value || undefined),
  /** Autorización de datos (Ley 1581 de 2012): sin ella no se registra el contacto. */
  consent: z.literal(true),
});

/** Formularios públicos (portada, colegios): cada envío entra al CRM como oportunidad nueva. */
export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, { name: "lead", limit: 5, globalLimit: 100, windowMs: 15 * 60_000 });
  if (limited) return limited;
  const body = await readBody(request, leadSchema, "Revisa los datos del formulario."); if (body instanceof Response) return body;
  const { source, campaign, consent, grades, ...contact } = body;
  try {
    const fullSource = campaign ? `${source} / ${campaign}` : source;
    const lead = { ...contact, grades: [...new Set(grades)].join(",") || null, source: fullSource };
    const id = await createLead({ ...lead, priority: "high", consentAt: consent ? new Date() : null }, { type: "form" });
    // Los correos (aviso al equipo y respuesta al contacto) salen después de responder: el lead ya quedó en el CRM aunque el SMTP falle o tarde.
    const origin = publicOrigin(request);
    after(async () => {
      const results = await Promise.allSettled([notifyNewLead({ id, ...lead }, origin), sendLeadAutoReply(lead)]);
      for (const result of results) if (result.status === "rejected") console.error("lead_notify_failed", result.reason);
    });
    return ok({ ok: true }, 201);
  } catch (error) { return handleError(error, "lead_create_failed", "El CRM no está disponible temporalmente."); }
}
