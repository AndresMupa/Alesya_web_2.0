import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { leadStageLabel } from "@/lib/crm/constants";
import { getLeadDetail } from "@/lib/crm/leads";
import { budgetLabel, gradesLabel, sectorLabel, techLevelLabel } from "@/lib/crm/score";
import { fillTemplate, templatesFor } from "@/lib/crm/templates";
import { DomainError } from "@/lib/http";
import { absoluteUrl } from "@/lib/site";

/**
 * Borrador de mensaje comercial con IA (Claude). El asesor pide un borrador para un colegio y un canal;
 * el modelo redacta un WhatsApp o un correo con los datos de la ficha, el objetivo de la etapa y la
 * plantilla de la casa como referencia. No envía nada: el asesor revisa, ajusta y envía como siempre.
 *
 * Variables: ANTHROPIC_API_KEY (obligatoria), CRM_AI_MODEL (opcional; por defecto claude-opus-5-5).
 * Para abaratar y acelerar este uso conviene CRM_AI_MODEL=claude-haiku-5-5 o claude-sonnet-5-5.
 */

export type DraftChannel = "whatsapp" | "email";
export type DraftInput = { channel: DraftChannel; asesor?: string | null; instruccion?: string };
export type Draft = { asunto: string; cuerpo: string };

const MODEL = process.env.CRM_AI_MODEL?.trim() || "claude-opus-5-5";

/** Si no hay clave, la IA no está disponible (el endpoint responde 503 y el asesor ve el aviso). */
export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

function parseDraft(text: string): Draft {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(text.slice(start, end + 1)) as { asunto?: unknown; cuerpo?: unknown };
      return { asunto: typeof parsed.asunto === "string" ? parsed.asunto : "", cuerpo: typeof parsed.cuerpo === "string" ? parsed.cuerpo : "" };
    } catch { /* cae al texto crudo */ }
  }
  return { asunto: "", cuerpo: text };
}

export async function draftMessage(leadId: string, input: DraftInput): Promise<Draft> {
  if (!aiConfigured()) throw new DomainError("La IA de borradores no está configurada en el servidor (falta ANTHROPIC_API_KEY).", 503);

  const detail = await getLeadDetail(leadId);
  if (!detail) throw new DomainError("La oportunidad no existe.", 404);
  const { lead, playbook, score } = detail;
  const asesor = input.asesor?.trim() || "el equipo comercial";
  const canal = input.channel === "whatsapp" ? "WhatsApp" : "correo electrónico";
  const esPrimerCorreoFrio = input.channel === "email" && lead.stage === "new";
  // En seguimiento (etapa distinta de "Nuevo") se comparte la propuesta viva de su cotización abierta más reciente, si la hay.
  const openQuote = lead.stage !== "new" ? detail.quotes.find((quote) => quote.status === "sent" || quote.status === "draft") : undefined;
  const propuesta = openQuote?.token ? absoluteUrl(`/propuesta/${openQuote.token}`) : null;

  // Plantilla de la casa, rellenada con los datos del colegio, como referencia de estilo.
  const reference = templatesFor(input.channel, lead.stage)[0];
  const referenceText = reference ? fillTemplate(reference.body, lead, input.asesor) : "";
  const referenceSubject = reference?.subject ? fillTemplate(reference.subject, lead, input.asesor) : "";

  const recientes = detail.activities
    .filter((activity) => !["created", "form", "import", "assignment", "stage_change"].includes(activity.type))
    .slice(0, 5)
    .map((activity) => `- ${activity.summary}`)
    .join("\n");

  const ficha = [
    `Canal: ${canal}`,
    `Etapa: ${leadStageLabel(lead.stage)}`,
    playbook && `Objetivo de esta etapa: ${playbook.nextAction}`,
    playbook && `Enfoque: ${playbook.hint}`,
    `Colegio: ${lead.organization}${lead.city ? ` (${lead.city})` : ""}`,
    `Contacto: ${lead.name}`,
    lead.decisionMaker && `Quién decide: ${lead.decisionMaker}`,
    lead.students ? `Estudiantes: ${lead.students}` : null,
    sectorLabel(lead.sector) && `Sector: ${sectorLabel(lead.sector)}`,
    gradesLabel(lead.grades) && `Niveles: ${gradesLabel(lead.grades)}`,
    techLevelLabel(lead.techLevel) && `Nivel tecnológico actual: ${techLevelLabel(lead.techLevel)}`,
    lead.budgetRange && lead.budgetRange !== "desconocido" && budgetLabel(lead.budgetRange) && `Presupuesto estimado: ${budgetLabel(lead.budgetRange)}`,
    lead.program && `Programa de interés: ${lead.program}`,
    lead.competitors && `Proveedor o programa actual: ${lead.competitors}`,
    lead.message && `Necesidad declarada: ${lead.message}`,
    lead.painPoints && `Dolores y necesidades: ${lead.painPoints}`,
    score.reasons.length && `Señales de la oportunidad: ${score.reasons.join("; ")}`,
    recientes && `Gestiones recientes:\n${recientes}`,
    lead.notes && `Notas internas (contexto para ti, NO citar textualmente): ${lead.notes}`,
    input.instruccion?.trim() && `Instrucción del asesor para este mensaje: ${input.instruccion.trim()}`,
    propuesta && `Link de la propuesta a la medida para este colegio (es un SEGUIMIENTO, no un primer contacto; inclúyelo cerca del cierre, junto al llamado a la acción, invitando a verla): ${propuesta}`,
  ].filter(Boolean).join("\n");

  const system = `Eres asesor comercial de Alesya X-Tech (marca de Alesya Ediciones). Acompañas a colegios e instituciones educativas de Colombia a llevar la robótica educativa y la cultura maker al aula POR GRADOS, de preescolar a 11°, con una ruta completa: texto del alumno, kit por nivel (LEGO, Arduino, impresión 3D), software, formación docente y una arena de competencia propia (Arena ALESYA X) con feria a fin de año.

Tu tarea: redactar UN mensaje de ${canal} para este colegio, listo para que el asesor lo revise y lo envíe. Escribe en español de Colombia, tratando de "usted", con tono profesional, cálido y cercano, sin sonar a robot ni a venta agresiva.

Reglas:
- Específico para este colegio: usa sus datos (grados, estudiantes, nivel actual, necesidad). Nada genérico.
- Posiciona la ruta completa por grados (preescolar a 11°); no la reduzcas a un kit ni a una sola marca (p. ej. "solo LEGO").
- Baja la barrera de entrada: el colegio puede empezar con UN grado piloto, y el material se trabaja en grupos (unos 3 estudiantes por kit), así la inversión por estudiante es baja. Menciónalo si viene al caso.
- El llamado a la acción de entrada es un diagnóstico o demostración SIN COSTO para el área académica (unos 20 minutos), no "comprar" de una.
- Puedes apoyarte, solo si encaja y es cierto, en el respaldo de Alesya Ediciones (editorial con autores propios) y el aliado pedagógico Universidad Cooperativa de Colombia. NO inventes otros respaldos, cifras ni testimonios.
- Si en la ficha aparece un "Link de la propuesta a la medida", inclúyelo tal cual en el mensaje, junto al llamado a la acción, invitando al colegio a verla. En un primer contacto NO viene ese link y no debes inventar ninguno.
- Un solo objetivo, alineado con la etapa, y un único llamado a la acción al final.
- NO inventes cifras de resultados, porcentajes, testimonios, nombres de otros colegios ni certificaciones. Si no tienes un dato, no lo afirmes.
- Nada de clichés de IA ("en el mundo actual", "en la era digital", "no dude en", "espero que este mensaje le encuentre bien", "en Alesya entendemos que..."). Ve al grano.
- Longitud: WhatsApp máximo ~90 palabras; correo máximo ~160 palabras. Frases cortas.
- Firma como ${asesor}.
${esPrimerCorreoFrio ? '- Es un primer contacto en frío por correo: cierra con una línea breve y cortés para que puedan pedir no recibir más mensajes (redáctala con naturalidad, no uses fórmulas robóticas tipo "responda STOP").\n' : ""}- Toma la plantilla de la casa como referencia de estilo y estructura, pero personalízala; no la copies literal.

Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional y sin bloques de código, con esta forma exacta:
{"asunto": "string", "cuerpo": "string"}
Para WhatsApp deja "asunto" como cadena vacía "". Usa saltos de línea reales dentro de "cuerpo".`;

  const userContent = `Ficha del colegio y la gestión:
${ficha}

Plantilla de la casa (referencia de estilo, NO copiar literal):
${esPrimerCorreoFrio && referenceSubject ? `Asunto sugerido: ${referenceSubject}\n` : ""}${referenceText || "(sin plantilla para esta etapa)"}`;

  const client = new Anthropic();
  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 3000,
      system,
      messages: [{ role: "user", content: userContent }],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) throw new DomainError("La clave de la IA (ANTHROPIC_API_KEY) no es válida.", 503);
    if (error instanceof Anthropic.RateLimitError) throw new DomainError("La IA está saturada en este momento. Intenta de nuevo en un minuto.", 429);
    console.error("crm_ai_draft_api_failed", error);
    throw new DomainError("No se pudo generar el borrador con IA.", 503);
  }

  if (response.stop_reason === "refusal") throw new DomainError("La IA no pudo redactar este mensaje. Ajusta la instrucción e intenta de nuevo.", 422);

  const text = response.content.filter((block): block is Anthropic.TextBlock => block.type === "text").map((block) => block.text).join("").trim();
  const draft = parseDraft(text);
  if (!draft.cuerpo.trim()) throw new DomainError("La IA devolvió un borrador vacío. Intenta de nuevo.", 502);
  // Seguro determinístico: si es seguimiento y el modelo olvidó el link, lo añadimos.
  if (propuesta && !draft.cuerpo.includes(propuesta)) {
    draft.cuerpo = `${draft.cuerpo.trimEnd()}\n\nPuede ver la propuesta a la medida para ${lead.organization} aquí: ${propuesta}`;
  }
  return input.channel === "whatsapp" ? { asunto: "", cuerpo: draft.cuerpo } : draft;
}
