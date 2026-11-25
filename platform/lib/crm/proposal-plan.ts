// Propuesta viva de robótica (/propuesta/[token]): catálogo del programa, lectura de la cotización y registro de
// lectura en el historial del lead. Seguro para cliente y servidor.

import type { ProposalSignals } from "@/lib/crm/score";

export type ProposalLevel = "pre" | "pri" | "bach";
export type ProposalPack = 1 | 2 | 3;
export type ProposalStudents = Record<ProposalLevel, number>;

/** Valores del catálogo 2025–2026 por estudiante (centavos): textos de preescolar y paquetes de proyectos STEM. */
export const PROGRAM_PRICES = { pre: 9_800_000, pack: { 1: 11_500_000, 2: 14_500_000, 3: 16_500_000 } as Record<ProposalPack, number> };
export const PROGRAM_PACKS: ProposalPack[] = [1, 2, 3];
/** El valor mensual reparte la inversión en los meses del año escolar. */
export const SCHOOL_MONTHS = 10;
const DEFAULT_STUDENTS: ProposalStudents = { pre: 60, pri: 180, bach: 120 };

/** Renglones del programa que la propuesta reconoce; el cajón de cotizaciones los ofrece como atajo. */
export const PROGRAM_LINES: { level: ProposalLevel; label: string; description: string; unitPriceInCents: number }[] = [
  { level: "pre", label: "Robótica · Preescolar", description: "Robótica Educativa · Preescolar: texto + cuento «Igor el Robot»", unitPriceInCents: PROGRAM_PRICES.pre },
  { level: "pri", label: "Robótica · Primaria", description: "Robótica Educativa · Primaria: texto + 2 proyectos STEM", unitPriceInCents: PROGRAM_PRICES.pack[2] },
  { level: "bach", label: "Robótica · Bachillerato", description: "Robótica Educativa · Bachillerato: texto + 2 proyectos STEM", unitPriceInCents: PROGRAM_PRICES.pack[2] },
];

/** Secciones de la propuesta, en orden: el riel, el modo presentación y la analítica de lectura usan estos ids. */
export const PROPOSAL_SECTIONS = [
  { id: "inicio", name: "Inicio" }, { id: "impacto", name: "Impacto" }, { id: "clase", name: "Clase" }, { id: "niveles", name: "Niveles" }, { id: "arena", name: "Arena" },
  { id: "inversion", name: "Inversión" }, { id: "plan", name: "Plan" }, { id: "confianza", name: "Confianza" }, { id: "siguiente", name: "Siguiente paso" },
] as const;
export type ProposalSectionId = (typeof PROPOSAL_SECTIONS)[number]["id"];
export const proposalSectionIds = PROPOSAL_SECTIONS.map((section) => section.id) as [ProposalSectionId, ...ProposalSectionId[]];

const plain = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Nivel de un renglón de textos de robótica. Los kits, la formación y otros servicios no cuentan estudiantes. */
export function programLevel(description: string): ProposalLevel | null {
  const text = plain(description);
  if (!text.includes("robot") || /\bkits?\b|formacion|docente|capacitacion|acompanamiento|instalacion/.test(text)) return null;
  if (/preescolar|pre-?jardin|jardin|transicion/.test(text)) return "pre";
  if (/primaria/.test(text)) return "pri";
  if (/bachillerato|secundaria|\bmedia\b/.test(text)) return "bach";
  return null;
}

function packOf(description: string, unitPriceInCents: number): ProposalPack | null {
  const match = plain(description).match(/\b([123])\s*proyectos?\b/);
  if (match) return Number(match[1]) as ProposalPack;
  return PROGRAM_PACKS.find((pack) => PROGRAM_PRICES.pack[pack] === unitPriceInCents) ?? null;
}

/** Reparte los estudiantes del estudio del colegio entre los niveles que atiende, en múltiplos de 5. */
function splitStudents(total: number, grades: string | null): ProposalStudents {
  if (total <= 0) return { ...DEFAULT_STUDENTS };
  const list = (grades ?? "").split(",").map((item) => item.trim());
  const found: ProposalLevel[] = [];
  if (list.includes("preescolar")) found.push("pre");
  if (list.includes("primaria")) found.push("pri");
  if (list.includes("secundaria") || list.includes("media")) found.push("bach");
  const levels = found.length ? found : (["pri", "bach"] as ProposalLevel[]);
  const each = Math.floor(total / levels.length / 5) * 5;
  const students: ProposalStudents = { pre: 0, pri: 0, bach: 0 };
  levels.forEach((level, index) => { students[level] = index === levels.length - 1 ? total - each * (levels.length - 1) : each; });
  return students;
}

export type ProposalPlan = {
  /** Estudiantes por nivel con que abre la calculadora. */
  students: ProposalStudents;
  /** Paquete de proyectos STEM de primaria y bachillerato. */
  pack: ProposalPack;
  /** Valor por estudiante de cada nivel en la cotización (centavos); con otro paquete rige el catálogo. */
  unit: Record<ProposalLevel, number>;
  /** Renglones que no son textos por nivel (kits, formación…) y descuento de la cotización. */
  extras: { description: string; totalInCents: number }[];
  extrasInCents: number;
  discountInCents: number;
  /** `true` si la cotización trae renglones por nivel; si no, la calculadora es solo una estimación de textos. */
  fromQuote: boolean;
};

type QuoteLine = { description: string; quantity: number; unitPriceInCents: number };

/** Lee la cotización como propuesta: estudiantes y paquete salen de los renglones de textos por nivel. */
export function readProposalPlan(items: QuoteLine[], discountInCents: number, lead: { students: number; grades: string | null }): ProposalPlan {
  const sums: Record<ProposalLevel, { quantity: number; cents: number }> = { pre: { quantity: 0, cents: 0 }, pri: { quantity: 0, cents: 0 }, bach: { quantity: 0, cents: 0 } };
  const extras: ProposalPlan["extras"] = [];
  let pack: ProposalPack | null = null;
  for (const item of items) {
    const line = Math.round(item.quantity * item.unitPriceInCents);
    const level = item.quantity > 0 ? programLevel(item.description) : null;
    if (!level) { extras.push({ description: item.description, totalInCents: line }); continue; }
    sums[level].quantity += item.quantity;
    sums[level].cents += line;
    if (level !== "pre") pack ??= packOf(item.description, item.unitPriceInCents);
  }
  const fromQuote = sums.pre.quantity + sums.pri.quantity + sums.bach.quantity > 0;
  const quotedPack = pack ?? 2;
  const unit = (level: ProposalLevel) => sums[level].quantity ? sums[level].cents / sums[level].quantity : level === "pre" ? PROGRAM_PRICES.pre : PROGRAM_PRICES.pack[quotedPack];
  return {
    students: fromQuote ? { pre: Math.round(sums.pre.quantity), pri: Math.round(sums.pri.quantity), bach: Math.round(sums.bach.quantity) } : splitStudents(lead.students, lead.grades),
    pack: quotedPack,
    unit: { pre: unit("pre"), pri: unit("pri"), bach: unit("bach") },
    extras: fromQuote ? extras : [],
    extrasInCents: fromQuote ? extras.reduce((acc, item) => acc + item.totalInCents, 0) : 0,
    discountInCents: fromQuote ? discountInCents : 0,
    fromQuote,
  };
}

/** Valor por estudiante de un nivel con el paquete elegido. */
export const levelPrice = (plan: ProposalPlan, level: ProposalLevel, pack: ProposalPack) => level === "pre" || pack === plan.pack ? plan.unit[level] : PROGRAM_PRICES.pack[pack];

/** Totales de la calculadora (centavos). Sin cambios frente a la cotización, `total` es el de la cotización. */
export function planTotals(plan: ProposalPlan, students: ProposalStudents, pack: ProposalPack) {
  const est = students.pre + students.pri + students.bach;
  const byLevel = { pre: students.pre * levelPrice(plan, "pre", pack), pri: students.pri * levelPrice(plan, "pri", pack), bach: students.bach * levelPrice(plan, "bach", pack) };
  const subtotal = Math.round(byLevel.pre + byLevel.pri + byLevel.bach + plan.extrasInCents);
  const total = subtotal - Math.min(subtotal, plan.discountInCents);
  return { est, byLevel, total, month: est ? total / est / SCHOOL_MONTHS : 0 };
}

/** Lo que el cliente ve en /propuesta/[token]: datos del lead y de la cotización, nunca de la URL. */
export type ProposalView = {
  token: string; number: string; title: string;
  /** Estado efectivo: una enviada con la vigencia vencida cuenta como vencida. */
  status: "draft" | "sent" | "accepted" | "rejected" | "expired";
  organization: string; city: string | null;
  asesor: string; asesorFirst: string | null; initials: string;
  validShort: string; validLong: string; daysLeft: number; decidedOn: string | null;
  totalInCents: number; plan: ProposalPlan; whatsappDigits: string;
};

// ── Analítica de lectura ─────────────────────────────────────────────────────

/** Tipo de actividad: una por visita a la propuesta, que se actualiza mientras el colegio la lee. */
export const PROPOSAL_ACTIVITY = "proposal_view";
/** Una visita cuenta como lectura a fondo con 2 minutos en pantalla o 6 secciones vistas. */
const DEEP_READ = { seconds: 120, sections: 6 };
const ARENA_MARK = "jugó la Arena";
const DEEP_MARK = "lectura a fondo";

export type ProposalRead = { sections: string[]; seconds: number; arena: boolean };

const duration = (seconds: number) => seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min${seconds % 60 ? ` ${seconds % 60} s` : ""}`;

/** Resumen de una visita para el historial del lead (solo secciones, tiempo y Arena: nada del visitante). */
export function proposalReadSummary(number: string, visit: number, read: ProposalRead) {
  const seen = PROPOSAL_SECTIONS.filter((section) => read.sections.includes(section.id)).map((section) => section.name);
  const parts = [`Abrió la propuesta ${number}${visit > 1 ? ` (visita ${visit})` : ""}`];
  if (seen.length) parts.push(`vio ${seen.length} de ${PROPOSAL_SECTIONS.length} secciones: ${seen.join(", ")}`);
  if (read.seconds >= 5) parts.push(`${duration(read.seconds)} en pantalla`);
  if (read.arena) parts.push(ARENA_MARK);
  if (read.seconds >= DEEP_READ.seconds || seen.length >= DEEP_READ.sections) parts.push(DEEP_MARK);
  return `${parts.join(" · ")}.`;
}

/** Señales de lectura de los últimos 90 días para el puntaje, a partir de las visitas registradas en el historial. */
export function proposalSignals(activities: { type: string; summary: string; createdAt: Date | number | string }[], now = Date.now()): ProposalSignals {
  const visits = activities.filter((activity) => activity.type === PROPOSAL_ACTIVITY && new Date(activity.createdAt).getTime() >= now - 90 * 86_400_000);
  const has = (mark: string) => visits.some((visit) => visit.summary.includes(` · ${mark}`));
  return { opened: visits.length > 0, deepRead: has(DEEP_MARK), arena: has(ARENA_MARK) };
}
