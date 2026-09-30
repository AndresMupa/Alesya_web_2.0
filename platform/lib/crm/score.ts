// Estudio del colegio y puntaje de la oportunidad. Seguro para cliente y servidor.

export const sectors = [{ value: "privado", label: "Privado" }, { value: "publico", label: "Público" }] as const;
export const calendars = [{ value: "A", label: "Calendario A" }, { value: "B", label: "Calendario B" }] as const;
export const gradeLevels = [{ value: "preescolar", label: "Preescolar" }, { value: "primaria", label: "Primaria" }, { value: "secundaria", label: "Secundaria" }, { value: "media", label: "Media" }] as const;
export const techLevels = [
  { value: "ninguno", label: "Sin robótica ni tecnología educativa", hint: "Terreno nuevo: hay que mostrar el valor." },
  { value: "basico", label: "Algo de robótica o programación", hint: "Ya creen en el tema: quieren crecer." },
  { value: "avanzado", label: "Programa consolidado", hint: "Buscan proveedor, materiales o formación." },
] as const;
export const budgetRanges = [
  { value: "desconocido", label: "Sin información" },
  { value: "menos_5m", label: "Menos de $5 M" },
  { value: "5_20m", label: "$5 M – $20 M" },
  { value: "20_50m", label: "$20 M – $50 M" },
  { value: "mas_50m", label: "Más de $50 M" },
] as const;

const labelOf = (list: readonly { value: string; label: string }[], value: string | null | undefined) => list.find((item) => item.value === value)?.label ?? null;
export const sectorLabel = (value: string | null | undefined) => labelOf(sectors, value);
export const techLevelLabel = (value: string | null | undefined) => labelOf(techLevels, value);
export const budgetLabel = (value: string | null | undefined) => labelOf(budgetRanges, value);
export const gradesLabel = (value: string | null | undefined) => (value ?? "").split(",").map((item) => labelOf(gradeLevels, item.trim())).filter(Boolean).join(", ") || null;

export type ScoreInput = {
  stage: string; students: number; sector: string | null; techLevel: string | null; budgetRange: string | null; program: string | null; decisionMaker: string | null;
  /** Gestiones de contacto (llamada, WhatsApp, correo, reunión, visita) en los últimos 90 días. */
  contacts: number; lastContact: string | null; today: string;
};

export type ScoreBreakdown = { total: number; grade: "A" | "B" | "C"; fit: number; engagement: number; reasons: string[] };

/**
 * Puntaje 0–100 = ajuste del colegio (hasta 60) + avance de la relación (hasta 40).
 * A ≥ 65 (prioridad), B ≥ 40, C el resto. Se recalcula cada vez que cambia la ficha o se registra una gestión.
 */
export function scoreLead(input: ScoreInput): ScoreBreakdown {
  const reasons: string[] = [];
  let fit = 0;
  if (input.students > 1000) { fit += 24; reasons.push("Colegio grande (+1.000 estudiantes)"); }
  else if (input.students > 500) { fit += 20; reasons.push("Colegio mediano-grande"); }
  else if (input.students > 200) { fit += 14; reasons.push("Colegio mediano"); }
  else if (input.students > 0) { fit += 8; reasons.push("Colegio pequeño"); }
  if (input.sector === "privado") { fit += 10; reasons.push("Sector privado"); }
  else if (input.sector === "publico") { fit += 4; reasons.push("Sector público"); }
  if (input.techLevel === "basico") { fit += 10; reasons.push("Ya tiene algo de robótica"); }
  else if (input.techLevel === "ninguno") { fit += 8; reasons.push("Sin programa: terreno nuevo"); }
  else if (input.techLevel === "avanzado") { fit += 6; reasons.push("Programa consolidado"); }
  const budget: Record<string, number> = { menos_5m: 4, "5_20m": 10, "20_50m": 14, mas_50m: 16 };
  if (input.budgetRange && budget[input.budgetRange]) { fit += budget[input.budgetRange]; reasons.push("Presupuesto identificado"); }
  if (input.decisionMaker) { fit += 3; reasons.push("Decisor identificado"); }
  if (input.program) { fit += 3; reasons.push("Programa de interés definido"); }
  fit = Math.min(60, fit);

  let engagement = 0;
  const byStage: Record<string, number> = { contacted: 8, meeting: 18, proposal: 26, won: 40 };
  engagement += byStage[input.stage] ?? 0;
  if (input.stage === "meeting") reasons.push("Reunión lograda");
  if (input.stage === "proposal") reasons.push("Cotización en evaluación");
  engagement += Math.min(3, input.contacts) * 3;
  if (input.contacts >= 2) reasons.push("Conversación activa");
  if (input.lastContact) {
    const days = Math.round((Date.parse(input.today) - Date.parse(input.lastContact)) / 86_400_000);
    if (days <= 7) engagement += 5; else if (days <= 30) engagement += 2; else if (input.stage !== "won") reasons.push("Sin contacto hace más de un mes");
  }
  engagement = input.stage === "lost" ? 0 : Math.min(40, engagement);

  const total = Math.min(100, fit + engagement);
  return { total, grade: total >= 65 ? "A" : total >= 40 ? "B" : "C", fit, engagement, reasons };
}

export const scoreGrade = (score: number) => (score >= 65 ? "A" : score >= 40 ? "B" : "C");
