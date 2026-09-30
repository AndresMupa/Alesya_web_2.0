// Catálogos del módulo CRM (etapas, prioridades, canales, actividades). Seguro para cliente y servidor.

export const leadStages = [
  { value: "new", label: "Nuevo" },
  { value: "contacted", label: "Contactado" },
  { value: "meeting", label: "Reunión" },
  { value: "proposal", label: "Propuesta" },
  { value: "won", label: "Ganado" },
  { value: "lost", label: "Perdido" },
] as const;

export type LeadStage = (typeof leadStages)[number]["value"];
export const leadStageValues = leadStages.map((stage) => stage.value) as [LeadStage, ...LeadStage[]];
export const openLeadStages: LeadStage[] = ["new", "contacted", "meeting", "proposal"];
export const closedLeadStages: LeadStage[] = ["won", "lost"];

export const leadPriorities = [
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low", label: "Baja" },
] as const;
export type LeadPriority = (typeof leadPriorities)[number]["value"];
export const leadPriorityValues = leadPriorities.map((priority) => priority.value) as [LeadPriority, ...LeadPriority[]];

/** Origen del contacto. `base_colegios_2026` es la base de prospección saliente; el resto son canales entrantes. */
export const leadSources = [
  { value: "base_colegios_2026", label: "Base colegios 2026" },
  { value: "website", label: "Sitio web" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "referral", label: "Referido" },
  { value: "event", label: "Evento o feria" },
  { value: "manual", label: "Otro" },
  { value: "import", label: "Importación CSV" },
] as const;
export type LeadSource = (typeof leadSources)[number]["value"];
export const leadSourceValues = leadSources.map((source) => source.value) as [LeadSource, ...LeadSource[]];
export const PROSPECT_SOURCE = "base_colegios_2026";
/** Canales que el asesor puede elegir al registrar un contacto a mano. */
export const manualLeadSources = leadSources.filter((source) => !["base_colegios_2026", "import"].includes(source.value));
/** Canales que el formulario público acepta desde los enlaces de campaña (`utm_source`). */
export const campaignChannels = ["linkedin", "instagram", "facebook", "whatsapp"] as const;

/** Actividades que registra el asesor. Las de contacto actualizan "último contacto" y avanzan un lead nuevo a "contactado". */
export const activityTypes = [
  { value: "call", label: "Llamada", contact: true },
  { value: "whatsapp", label: "WhatsApp", contact: true },
  { value: "email", label: "Correo", contact: true },
  { value: "meeting", label: "Reunión", contact: true },
  { value: "visit", label: "Visita", contact: true },
  { value: "note", label: "Nota interna", contact: false },
] as const;
export type ActivityType = (typeof activityTypes)[number]["value"];
export const activityTypeValues = activityTypes.map((type) => type.value) as [ActivityType, ...ActivityType[]];

/** Actividades automáticas que escribe el sistema. */
const systemActivityLabels: Record<string, string> = { created: "Registro", stage_change: "Cambio de etapa", assignment: "Asignación", form: "Formulario web", import: "Importación" };

export const lostReasons = ["Precio", "Sin presupuesto este año", "Eligió otro proveedor", "Sin respuesta", "No es el momento", "Datos de contacto errados", "Otro"] as const;

const labelOf = (list: readonly { value: string; label: string }[], value: string) => list.find((item) => item.value === value)?.label ?? value;
export const leadStageLabel = (value: string) => labelOf(leadStages, value);
export const leadPriorityLabel = (value: string) => labelOf(leadPriorities, value);
/** Los formularios guardan `canal / campaña`; se etiqueta el canal y se conserva la campaña. */
export function leadSourceLabel(value: string) {
  const [channel, campaign] = value.split(" / ");
  const label = labelOf(leadSources, channel);
  return campaign ? `${label} · ${campaign}` : label;
}
export const activityTypeLabel = (value: string) => systemActivityLabels[value] ?? labelOf(activityTypes, value);
export const isContactActivity = (value: string) => activityTypes.some((type) => type.value === value && type.contact);
