// Plantillas de mensajes para prospección. Seguras para cliente y servidor.
// Marcadores: {nombre} (primer nombre), {institucion}, {ciudad}, {asesor}.

export type MessageTemplate = { id: string; label: string; channel: "whatsapp" | "email"; subject?: string; body: string; stages: readonly string[] };

const SITE = "https://nueva.alesyaediciones.com";

export const messageTemplates: MessageTemplate[] = [
  {
    id: "first-contact", label: "Primer contacto", channel: "whatsapp", stages: ["new"],
    body: "Hola {nombre}, le saluda {asesor} de Alesya X-Tech. Acompañamos colegios de {ciudad} a implementar robótica y cultura maker por grados: dotación, formación docente y rutas de proyectos listas para el aula.\n\n¿Tendría 15 minutos esta semana para contarle cómo funcionaría en {institucion}?",
  },
  {
    id: "follow-up", label: "Seguimiento sin respuesta", channel: "whatsapp", stages: ["new", "contacted"],
    body: "Hola {nombre}, le escribí hace unos días desde Alesya X-Tech sobre el programa de robótica educativa para {institucion}. ¿Le gustaría que le comparta por este medio una propuesta general con los proyectos por grado?",
  },
  {
    id: "meeting", label: "Proponer reunión", channel: "whatsapp", stages: ["contacted", "meeting"],
    body: "Hola {nombre}, gracias por su respuesta. ¿Le parece si agendamos una reunión virtual de 30 minutos para revisar cómo sería el programa de robótica en {institucion}? Puedo esta semana en la mañana o en la tarde, según le convenga.",
  },
  {
    id: "proposal", label: "Enviar propuesta", channel: "whatsapp", stages: ["meeting", "proposal"],
    body: "Hola {nombre}, gracias por la conversación. Le comparto la ruta propuesta para {institucion}: diagnóstico, dotación por grados, formación docente y acompañamiento. Quedo atento a sus comentarios para ajustar lo que necesiten.",
  },
  {
    id: "proposal-follow-up", label: "Seguimiento a propuesta", channel: "whatsapp", stages: ["proposal"],
    body: "Hola {nombre}, ¿pudo revisar la propuesta de robótica para {institucion}? Con gusto resuelvo dudas o ajustamos alcance y presupuesto para que encaje con el plan del colegio.",
  },
  {
    id: "email-first", label: "Correo de presentación", channel: "email", stages: ["new", "contacted"],
    subject: "Robótica educativa para {institucion}",
    body: "Estimado/a {nombre}:\n\nLe saluda {asesor}, de Alesya X-Tech (Alesya Ediciones). Acompañamos colegios de {ciudad} a implementar robótica y cultura maker por grados: dotación (LEGO, Arduino, impresión 3D), formación docente y rutas de proyectos listas para el aula.\n\nMe gustaría presentarle cómo sería un programa para {institucion}. Puede ver la propuesta general aquí: " + SITE + "/colegios?utm_source=email&utm_campaign=colegios_2026\n\n¿Tendría disponibilidad esta semana para una reunión de 30 minutos?\n\nCordialmente,\n{asesor}\nAlesya X-Tech · +57 300 593 7840",
  },
];

const titleCase = (value: string) => value.toLowerCase().replace(/(^|\s)\S/g, (char) => char.toUpperCase());

const TITLES = /^(sor|hna\.?|hno\.?|hermana|hermano|padre|pbro\.?|madre|dr\.?|dra\.?|lic\.?|mg\.?|mag\.?|ing\.?|prof\.?|esp\.?|ph\.?d\.?|sr\.?|sra\.?|srta\.?|don|doña)$/i;

/** Rellena los marcadores. Los nombres de la base vienen en mayúsculas; se usa el primer nombre en formato título. */
export function fillTemplate(text: string, lead: { name: string; organization: string; city?: string | null }, asesor?: string | null) {
  // Salta títulos (Sor, Hna., Dr., Ing.…) para saludar por el nombre de pila.
  const parts = lead.name.trim().split(/\s+/);
  const firstName = parts.find((part) => !TITLES.test(part)) ?? parts[0] ?? "";
  const nombre = /equipo|rector|directiv/i.test(lead.name) ? "" : titleCase(firstName);
  return text
    .replace(/\{nombre\}/g, nombre)
    .replace(/\{institucion\}/g, lead.organization.trim())
    .replace(/\{ciudad\}/g, (lead.city ?? "").replace(/,\s*D\.?\s*C\.?$/i, "").trim() || "la región")
    .replace(/\{asesor\}/g, asesor?.trim() || "el equipo comercial")
    .replace(/Hola ,/g, "Hola,")
    .replace(/Estimado\/a :/g, "Estimado/a equipo directivo:");
}

export const templatesFor = (channel: MessageTemplate["channel"], stage: string) =>
  messageTemplates.filter((template) => template.channel === channel).sort((a, b) => Number(b.stages.includes(stage)) - Number(a.stages.includes(stage)));
