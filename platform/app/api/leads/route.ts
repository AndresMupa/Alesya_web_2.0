import { after } from "next/server";
import { z } from "zod";
import { cleanAttribution } from "@/lib/crm/attribution";
import { WAITLIST_PROGRAM, formLeadSources } from "@/lib/crm/constants";
import { CURRENT_MARKETING_CONSENT, dataConsentVersions, marketingChannels, marketingConsentVersions } from "@/lib/crm/consent";
import { createLead } from "@/lib/crm/leads";
import { budgetRanges, calendars, gradeLevels, roboticsPlatforms, sectors, techLevels } from "@/lib/crm/score";
import { getStoreProduct } from "@/lib/commerce/catalog";
import { notifyNewLead, sendLeadAutoReply } from "@/lib/commerce/notifications";
import { fail, handleError, ok, readBody } from "@/lib/http";
import { publicOrigin } from "@/lib/payments/wompi";
import { enforceRateLimit } from "@/lib/rate-limit";

const gradeValues = gradeLevels.map((level) => level.value) as [string, ...string[]];
const values = <T extends readonly { value: string }[]>(list: T) => list.map((item) => item.value) as [string, ...string[]];

/** Campo opcional de una lista cerrada: el select sin elegir llega como cadena vacía y cuenta como ausente. */
const choice = (list: readonly [string, ...string[]]) => z.preprocess((value) => (value === "" || value === null ? undefined : value), z.enum(list).optional());
/** Dato de la URL o del navegador: nunca hace fallar el envío; `cleanAttribution` lo limpia y lo limita después. */
const touchField = z.string().max(600).optional().catch("");

const leadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  /** Obligatorio salvo en la lista de espera de un producto, donde puede ser una persona sin institución. */
  organization: z.string().trim().min(2).max(160).optional(),
  email: z.string().trim().email().max(180),
  phone: z.string().trim().max(30).optional().transform((value) => value || undefined),
  /** Obligatorio salvo en la lista de espera, donde el servidor lo arma con el producto. */
  message: z.string().trim().min(8).max(2000).optional(),
  source: z.enum(formLeadSources).default("website"),
  campaign: z.string().trim().regex(/^[a-zA-Z0-9_-]{0,40}$/).default(""),
  /** Calificación opcional: niveles de interés, estudiantes aproximados y el programa de la página. */
  grades: z.array(z.enum(gradeValues)).max(gradeValues.length).default([]),
  students: z.coerce.number().int().min(0).max(50_000).default(0),
  program: z.string().trim().max(80).optional().transform((value) => value || undefined),
  /** Estudio del colegio, también opcional: alimenta el puntaje (sector, nivel tecnológico, presupuesto) y la ficha. */
  sector: choice(values(sectors)),
  calendar: choice(values(calendars)),
  techLevel: choice(values(techLevels)),
  budgetRange: choice(values(budgetRanges)),
  competitors: choice(roboticsPlatforms as unknown as [string, ...string[]]),
  /** Lista de espera: producto del catálogo (el servidor lo verifica) y cantidad deseada. */
  productSlug: z.string().trim().max(200).optional(),
  quantity: z.preprocess((value) => (value === "" || value === null ? undefined : value), z.coerce.number().int().min(1).max(999).optional()),
  /** Autorización de datos (Ley 1581 de 2012): sin ella no se registra el contacto. Se guarda con la versión del texto que vio. */
  consent: z.literal(true),
  consentVersion: z.enum(dataConsentVersions).default("datos-diagnostico-v1-borrador"),
  /** Comunicaciones comerciales (Ley 2300 de 2023): casilla aparte, opcional y sin marcar de fábrica. */
  marketingConsent: z.boolean().default(false),
  marketingConsentVersion: z.enum(marketingConsentVersions).default(CURRENT_MARKETING_CONSENT),
  /** Primer toque guardado por el navegador. */
  attribution: z.object({ utmSource: touchField, utmMedium: touchField, utmCampaign: touchField, utmContent: touchField, utmTerm: touchField, referrer: touchField, landingPage: touchField }).optional().catch(undefined),
});

/** Formularios públicos (portada, colegios, lista de espera): cada envío entra al CRM como oportunidad nueva. */
export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, { name: "lead", limit: 5, globalLimit: 100, windowMs: 15 * 60_000 });
  if (limited) return limited;
  const body = await readBody(request, leadSchema, "Revisa los datos del formulario."); if (body instanceof Response) return body;
  const { source, campaign, consent, consentVersion, marketingConsent, marketingConsentVersion, grades, productSlug, quantity, attribution, ...contact } = body;
  try {
    let { organization, message, program } = contact;
    let leadCampaign = campaign;
    let productName: string | undefined;
    if (productSlug) {
      // La lista de espera la arma el servidor con el producto real del catálogo, no con lo que diga el navegador.
      const product = await getStoreProduct(productSlug);
      if (!product) return fail("Ese producto ya no está disponible.", 404);
      program = WAITLIST_PROGRAM;
      productName = product.name;
      organization = organization || "Particular";
      message = `Lista de espera: ${product.name} (${product.slug}).${quantity ? ` Cantidad: ${quantity}.` : ""}`;
      leadCampaign = `espera_${product.slug.replace(/[^a-zA-Z0-9_-]/g, "-")}`.slice(0, 40);
    }
    if (!organization || !message) return fail("Revisa los datos del formulario.");
    const fullSource = leadCampaign ? `${source} / ${leadCampaign}` : source;
    const now = new Date();
    const lead = { ...contact, organization, message, program, productName, grades: [...new Set(grades)].join(",") || null, source: fullSource };
    const { id, unsubscribeToken } = await createLead({
      ...lead, priority: "high", attribution: cleanAttribution(attribution ?? {}),
      consentAt: consent ? now : null, consentVersion,
      ...(marketingConsent && { marketingConsentAt: now, marketingConsentVersion, marketingChannels: marketingChannels(contact) }),
    }, { type: "form" });
    // Los correos (aviso al equipo y respuesta al contacto) salen después de responder: el lead ya quedó en el CRM aunque el SMTP falle o tarde.
    const origin = publicOrigin(request);
    after(async () => {
      const results = await Promise.allSettled([notifyNewLead({ id, ...lead }, origin), sendLeadAutoReply({ ...lead, unsubscribeUrl: `${origin}/baja/${unsubscribeToken}` })]);
      for (const result of results) if (result.status === "rejected") console.error("lead_notify_failed", result.reason);
    });
    return ok({ ok: true }, 201);
  } catch (error) { return handleError(error, "lead_create_failed", "El CRM no está disponible temporalmente."); }
}
