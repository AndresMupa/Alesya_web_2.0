import "server-only";
import { and, asc, count, desc, eq, gte, inArray, like, ne, not, or, sql, sum } from "drizzle-orm";
import { getDb } from "@/db";
import { leadActivities, leads } from "@/db/schema";
import { PROSPECT_SOURCE, leadStages, stagePlaybook, type LeadStage } from "@/lib/crm/constants";
import { scoreGrade } from "@/lib/crm/score";

const DAY = 86_400_000;
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;
const openStages: LeadStage[] = ["contacted", "meeting", "proposal"];
const labelToStage = new Map<string, LeadStage>(leadStages.map((stage) => [stage.label, stage.value]));

/** Etapa destino de un evento "X → Y" del historial. */
const targetStage = (summary: string) => { const match = summary.match(/→ ([^·(]+)/); return match ? labelToStage.get(match[1].trim()) ?? null : null; };

function weekStart(at: Date) {
  const local = new Date(at.getTime() - BOGOTA_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - ((local.getUTCDay() + 6) % 7))).toISOString().slice(0, 10);
}

/**
 * Analítica comercial: pronóstico ponderado por etapa y mes de cierre, conversión entre etapas, días por
 * etapa, distribución de puntajes, colegios por ciudad, programa y sector, efectividad por canal y
 * contactos entrantes por semana.
 */
export async function getAnalytics() {
  const db = getDb();
  const ninetyDays = new Date(Date.now() - 90 * DAY);
  const halfYear = new Date(Date.now() - 180 * DAY);
  const eightWeeks = new Date(Date.now() - 63 * DAY);
  const isProspect = like(leads.source, `${PROSPECT_SOURCE}%`);
  const notClosed = not(inArray(leads.stage, ["lost"]));

  const [openDeals, stageEvents, byCity, byProgram, bySector, contactsByChannel, attempts, scored, inbound] = await Promise.all([
    db.select({ stage: leads.stage, value: leads.estimatedValueInCents, expectedClose: leads.expectedClose, score: leads.score }).from(leads).where(inArray(leads.stage, openStages)),
    db.select({ leadId: leadActivities.leadId, summary: leadActivities.summary, createdAt: leadActivities.createdAt }).from(leadActivities).where(and(eq(leadActivities.type, "stage_change"), gte(leadActivities.createdAt, halfYear))).orderBy(asc(leadActivities.leadId), asc(leadActivities.createdAt)),
    db.select({ city: sql<string>`coalesce(${leads.city}, 'Sin ciudad')`, total: count(), worked: sql<number>`sum(case when ${leads.stage} <> 'new' then 1 else 0 end)`, open: sql<number>`sum(case when ${leads.stage} in ('contacted','meeting','proposal') then 1 else 0 end)`, won: sql<number>`sum(case when ${leads.stage} = 'won' then 1 else 0 end)`, value: sql<number>`sum(case when ${leads.stage} in ('contacted','meeting','proposal') then ${leads.estimatedValueInCents} else 0 end)` }).from(leads).groupBy(leads.city).orderBy(desc(count())).limit(12),
    db.select({ program: leads.program, total: count(), won: sql<number>`sum(case when ${leads.stage} = 'won' then 1 else 0 end)`, value: sum(leads.estimatedValueInCents) }).from(leads).where(sql`${leads.program} is not null and ${leads.program} <> ''`).groupBy(leads.program).orderBy(desc(count())).limit(8),
    db.select({ sector: sql<string>`coalesce(${leads.sector}, 'sin_dato')`, total: count(), won: sql<number>`sum(case when ${leads.stage} = 'won' then 1 else 0 end)`, students: sum(leads.students) }).from(leads).where(notClosed).groupBy(leads.sector),
    db.select({ channel: leadActivities.type, total: count() }).from(leadActivities).where(and(inArray(leadActivities.type, ["whatsapp", "call", "email"]), gte(leadActivities.createdAt, ninetyDays))).groupBy(leadActivities.type),
    db.select({ summary: leadActivities.summary }).from(leadActivities).where(and(eq(leadActivities.type, "attempt"), gte(leadActivities.createdAt, ninetyDays))),
    db.select({ score: leads.score, stage: leads.stage }).from(leads).where(and(notClosed, or(ne(leads.stage, "new"), not(isProspect)))),
    db.select({ createdAt: leads.createdAt }).from(leads).where(and(not(isProspect), gte(leads.createdAt, eightWeeks))),
  ]);

  // Pronóstico ponderado por la probabilidad de la etapa, agrupado por mes de cierre esperado.
  const months = new Map<string, { month: string; deals: number; valueInCents: number; weightedInCents: number }>();
  let weightedTotal = 0, valueTotal = 0;
  for (const deal of openDeals) {
    const probability = stagePlaybook[deal.stage as LeadStage]?.probability ?? 0;
    const month = deal.expectedClose?.slice(0, 7) ?? "sin-fecha";
    const bucket = months.get(month) ?? { month, deals: 0, valueInCents: 0, weightedInCents: 0 };
    bucket.deals += 1; bucket.valueInCents += deal.value; bucket.weightedInCents += Math.round(deal.value * probability);
    months.set(month, bucket);
    weightedTotal += Math.round(deal.value * probability); valueTotal += deal.value;
  }
  const forecast = { valueInCents: valueTotal, weightedInCents: weightedTotal, deals: openDeals.length, byMonth: Array.from(months.values()).sort((a, b) => (a.month === "sin-fecha" ? 1 : b.month === "sin-fecha" ? -1 : a.month.localeCompare(b.month))) };

  // Conversión: colegios que alcanzaron cada etapa en 6 meses, y días promedio que pasan en cada etapa.
  const reached: Record<string, Set<string>> = { contacted: new Set(), meeting: new Set(), proposal: new Set(), won: new Set(), lost: new Set() };
  const durations: Record<string, number[]> = {};
  let previous: { leadId: string; stage: string; at: number } | null = null;
  for (const event of stageEvents) {
    const stage = targetStage(event.summary);
    if (!stage) continue;
    reached[stage]?.add(event.leadId);
    if (previous && previous.leadId === event.leadId) (durations[previous.stage] ??= []).push((event.createdAt.getTime() - previous.at) / DAY);
    previous = { leadId: event.leadId, stage, at: event.createdAt.getTime() };
  }
  // Alcance acumulado: quien llegó a Reunión pasó (aunque fuera de un salto) por Contactado, y así sucesivamente.
  const order = ["contacted", "meeting", "proposal", "won"] as const;
  const atLeast = order.map((_, index) => new Set(order.slice(index).flatMap((stage) => Array.from(reached[stage]))));
  const rate = (from: number, to: number) => (from ? Math.min(100, Math.round((to / from) * 100)) : null);
  const conversion = [
    { step: "Contactado → Reunión", from: atLeast[0].size, to: atLeast[1].size, rate: rate(atLeast[0].size, atLeast[1].size) },
    { step: "Reunión → Propuesta", from: atLeast[1].size, to: atLeast[2].size, rate: rate(atLeast[1].size, atLeast[2].size) },
    { step: "Propuesta → Ganado", from: atLeast[2].size, to: atLeast[3].size, rate: rate(atLeast[2].size, atLeast[3].size) },
  ];
  const daysInStage = openStages.map((stage) => { const list = durations[stage] ?? []; return { stage, label: leadStages.find((item) => item.value === stage)!.label, avgDays: list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : null, samples: list.length }; });

  // Efectividad por canal: contactos logrados frente a intentos sin respuesta (el intento guarda el canal al inicio del texto).
  const attemptsByChannel = { whatsapp: 0, call: 0, email: 0 };
  for (const row of attempts) { if (row.summary.startsWith("WhatsApp")) attemptsByChannel.whatsapp++; else if (row.summary.startsWith("Llamada")) attemptsByChannel.call++; else if (row.summary.startsWith("Correo")) attemptsByChannel.email++; }
  const contacts = Object.fromEntries(contactsByChannel.map((row) => [row.channel, row.total]));
  const channels = (["whatsapp", "call", "email"] as const).map((channel) => { const ok = Number(contacts[channel] ?? 0), miss = attemptsByChannel[channel]; return { channel, label: channel === "whatsapp" ? "WhatsApp" : channel === "call" ? "Llamada" : "Correo", contacts: ok, attempts: miss, answerRate: ok + miss ? Math.round((ok / (ok + miss)) * 100) : null }; });

  const grades = { A: 0, B: 0, C: 0 };
  for (const row of scored) grades[scoreGrade(row.score)]++;

  const weeks = new Map<string, number>();
  for (let index = 8; index >= 0; index--) weeks.set(weekStart(new Date(Date.now() - index * 7 * DAY)), 0);
  for (const row of inbound) { const week = weekStart(row.createdAt); if (weeks.has(week)) weeks.set(week, (weeks.get(week) ?? 0) + 1); }

  return {
    forecast, conversion, daysInStage, channels, grades,
    byCity: byCity.map((row) => ({ city: row.city, total: row.total, worked: Number(row.worked), open: Number(row.open), won: Number(row.won), valueInCents: Number(row.value) })),
    byProgram: byProgram.map((row) => ({ program: row.program!, total: row.total, won: Number(row.won), valueInCents: Number(row.value ?? 0) })),
    bySector: bySector.map((row) => ({ sector: row.sector, total: row.total, won: Number(row.won), students: Number(row.students ?? 0) })),
    inboundByWeek: Array.from(weeks.entries()).map(([week, total]) => ({ week, total })),
  };
}

export type Analytics = Awaited<ReturnType<typeof getAnalytics>>;
