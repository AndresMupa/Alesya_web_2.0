import "server-only";
import { and, asc, count, desc, eq, gte, inArray, isNull, like, lte, not, or, sql, sum, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { leadActivities, leads, orders } from "@/db/schema";
import { bogotaDay, bogotaMonthStart } from "@/lib/format";
import { DomainError } from "@/lib/http";
import {
  MAX_ATTEMPTS, PROSPECT_SOURCE, activityTypes, isContactActivity, leadPriorities, leadPriorityValues, leadSourceLabel, leadSourceValues, leadStageLabel, leadStages, leadStageValues, openLeadStages, workActivityTypes,
  type ActivityType, type ContactChannel, type LeadPriority, type LeadStage, type Outcome,
} from "@/lib/crm/constants";

export type Lead = typeof leads.$inferSelect;
export type LeadActivity = typeof leadActivities.$inferSelect;
type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export const LEADS_PAGE_SIZE = 40;

// ── Consultas ────────────────────────────────────────────────────────────────

export type LeadFilters = { search?: string; stage?: string; priority?: string; source?: string; owner?: string; city?: string; due?: boolean };

export function leadFiltersFrom(params: URLSearchParams): LeadFilters {
  return { search: params.get("search") ?? "", stage: params.get("stage") ?? "", priority: params.get("priority") ?? "", source: params.get("source") ?? "", owner: params.get("owner") ?? "", city: params.get("city") ?? "", due: params.get("due") === "1" };
}

const ownerCondition = (owner?: string) => owner === "none" ? isNull(leads.owner) : owner ? eq(leads.owner, owner.slice(0, 120)) : undefined;
const cityCondition = (city?: string) => city ? eq(leads.city, city.slice(0, 100)) : undefined;

/** Responsables y ciudades presentes en la base, para los filtros del panel. */
export async function listFacets() {
  const db = getDb();
  const [owners, cities] = await Promise.all([
    db.selectDistinct({ owner: leads.owner }).from(leads).where(sql`${leads.owner} is not null and ${leads.owner} <> ''`).orderBy(asc(leads.owner)).limit(50),
    db.select({ city: leads.city, total: count() }).from(leads).where(sql`${leads.city} is not null and ${leads.city} <> ''`).groupBy(leads.city).orderBy(desc(count())).limit(60),
  ]);
  return { owners: owners.map((row) => row.owner!), cities: cities.map((row) => row.city!) };
}

const priorityOrder = sql`case ${leads.priority} when 'high' then 0 when 'medium' then 1 else 2 end`;
const isProspect = like(leads.source, `${PROSPECT_SOURCE}%`);
const dueCondition = (today = bogotaDay()) => and(lte(leads.nextFollowUp, today), inArray(leads.stage, openLeadStages));

function leadCondition(filters: LeadFilters): SQL | undefined {
  const search = filters.search?.trim().slice(0, 100);
  const pattern = `%${search}%`;
  return and(
    search ? or(like(leads.organization, pattern), like(leads.name, pattern), like(leads.email, pattern), like(leads.city, pattern), like(leads.externalId, pattern), like(leads.phone, pattern)) : undefined,
    leadStageValues.includes(filters.stage as LeadStage) ? eq(leads.stage, filters.stage!) : undefined,
    leadPriorityValues.includes(filters.priority as LeadPriority) ? eq(leads.priority, filters.priority!) : undefined,
    filters.source === "inbound" ? not(isProspect) : leadSourceValues.includes(filters.source as never) ? like(leads.source, `${filters.source}%`) : undefined,
    ownerCondition(filters.owner),
    cityCondition(filters.city),
    filters.due ? dueCondition() : undefined,
  );
}

export async function listLeads(filters: LeadFilters, page = 1) {
  const db = getDb();
  const condition = leadCondition(filters);
  const [rows, [total], [all], [due], [fresh], facets] = await Promise.all([
    db.select().from(leads).where(condition).orderBy(priorityOrder, desc(leads.updatedAt)).limit(LEADS_PAGE_SIZE).offset((page - 1) * LEADS_PAGE_SIZE),
    db.select({ value: count() }).from(leads).where(condition),
    db.select({ value: count() }).from(leads),
    db.select({ value: count() }).from(leads).where(dueCondition()),
    db.select({ value: count() }).from(leads).where(eq(leads.stage, "new")),
    listFacets(),
  ]);
  return { rows, page, pageSize: LEADS_PAGE_SIZE, total: total.value, metrics: { all: all.value, due: due.value, new: fresh.value }, ...facets };
}

export async function getLeadDetail(id: string) {
  const db = getDb();
  const [lead] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  if (!lead) return null;
  const [activities, relatedOrders] = await Promise.all([
    db.select().from(leadActivities).where(eq(leadActivities.leadId, id)).orderBy(desc(leadActivities.createdAt)).limit(100),
    lead.email ? db.select({ id: orders.id, reference: orders.reference, status: orders.status, totalInCents: orders.totalInCents, createdAt: orders.createdAt }).from(orders).where(sql`lower(${orders.customerEmail}) = lower(${lead.email})`).orderBy(desc(orders.createdAt)).limit(20) : Promise.resolve([]),
  ]);
  return { lead, activities, orders: relatedOrders };
}

// ── Escrituras ───────────────────────────────────────────────────────────────

export type LeadInput = {
  name: string; organization: string; email?: string | null; phone?: string | null; city?: string | null; website?: string | null; message: string; source: string;
  priority?: LeadPriority; owner?: string | null; notes?: string; estimatedValueInCents?: number; nextFollowUp?: string | null; externalId?: string | null;
};

const clean = (value: string | null | undefined) => value?.trim() || null;

function leadValues(input: LeadInput, now: Date) {
  return {
    id: crypto.randomUUID(), name: input.name.trim(), organization: input.organization.trim(), email: clean(input.email)?.toLowerCase() ?? null, phone: clean(input.phone), city: clean(input.city), website: clean(input.website),
    message: input.message.trim(), source: input.source, stage: "new", priority: input.priority ?? "medium", owner: clean(input.owner), notes: input.notes?.trim() ?? "", estimatedValueInCents: input.estimatedValueInCents ?? 0,
    nextFollowUp: input.nextFollowUp ?? null, externalId: clean(input.externalId), stageChangedAt: now, createdAt: now, updatedAt: now,
  };
}

/** Crea un contacto y deja la primera entrada del historial (registro manual o formulario web). */
export async function createLead(input: LeadInput, origin: { type: "created" | "form"; actor?: string | null }) {
  const db = getDb();
  const now = new Date();
  const values = leadValues(input, now);
  const summary = origin.type === "form" ? `Llegó por el formulario (${input.source}).` : `Registrado a mano (${input.source}).`;
  await db.batch([
    db.insert(leads).values(values),
    db.insert(leadActivities).values({ id: crypto.randomUUID(), leadId: values.id, type: origin.type, summary, createdBy: origin.actor ?? null, createdAt: now }),
  ]);
  return values.id;
}

export type LeadPatch = Partial<{
  name: string; organization: string; email: string | null; phone: string | null; city: string | null; website: string | null; owner: string | null; priority: LeadPriority; stage: LeadStage;
  notes: string; lastContact: string | null; nextFollowUp: string | null; estimatedValueInCents: number; lostReason: string | null;
}>;

async function insertActivity(tx: Tx, leadId: string, type: string, summary: string, actor: string | null, at: Date) {
  await tx.insert(leadActivities).values({ id: crypto.randomUUID(), leadId, type, summary, createdBy: actor, createdAt: at });
}

/** Un contacto sin responsable pasa a quien lo gestiona primero (si el actor es un asesor con nombre, no el correo de la sesión). */
async function claimIfUnowned(tx: Tx, leadId: string, owner: string | null, actor: string | null, changes: Record<string, unknown>, at: Date) {
  if (owner || !actor || actor.includes("@")) return;
  changes.owner = actor;
  await insertActivity(tx, leadId, "assignment", `Responsable: ${actor} (por gestionarlo primero)`, actor, new Date(at.getTime() + 2));
}

/** Actualiza un contacto. Los cambios de etapa y responsable quedan en el historial. */
export async function updateLead(id: string, patch: LeadPatch, actor: string | null) {
  return getDb().transaction(async (tx) => {
    const [current] = await tx.select().from(leads).where(eq(leads.id, id)).limit(1);
    if (!current) throw new DomainError("La oportunidad no existe.", 404);
    const now = new Date();
    const changes: Record<string, unknown> = { updatedAt: now };
    for (const [key, value] of Object.entries(patch)) if (value !== undefined) changes[key] = typeof value === "string" ? value.trim() : value;
    if (typeof changes.email === "string") changes.email = (changes.email as string).toLowerCase() || null;
    for (const key of ["phone", "city", "website", "owner"] as const) if (changes[key] === "") changes[key] = null;

    if (patch.stage && patch.stage !== current.stage) {
      changes.stageChangedAt = now;
      if (patch.stage !== "lost") changes.lostReason = null;
      const reason = patch.stage === "lost" && patch.lostReason ? ` · Motivo: ${patch.lostReason}` : "";
      await insertActivity(tx, id, "stage_change", `${leadStageLabel(current.stage)} → ${leadStageLabel(patch.stage)}${reason}`, actor, now);
    }
    if (patch.owner !== undefined && (changes.owner ?? null) !== current.owner) {
      await insertActivity(tx, id, "assignment", changes.owner ? `Responsable: ${changes.owner}` : "Se quitó el responsable.", actor, now);
    }
    await tx.update(leads).set(changes).where(eq(leads.id, id));
    return { ...current, ...changes } as Lead;
  });
}

/**
 * Registra una gestión (llamada, WhatsApp, reunión…). Las de contacto fijan "último contacto" en hoy y
 * pasan un lead nuevo a "contactado"; también se puede programar el siguiente seguimiento.
 */
export async function logActivity(id: string, input: { type: ActivityType; summary: string; nextFollowUp?: string | null }, actor: string | null) {
  return getDb().transaction(async (tx) => {
    const [current] = await tx.select({ stage: leads.stage, owner: leads.owner }).from(leads).where(eq(leads.id, id)).limit(1);
    if (!current) throw new DomainError("La oportunidad no existe.", 404);
    const now = new Date();
    const typeLabel = activityTypes.find((type) => type.value === input.type)?.label ?? input.type;
    await insertActivity(tx, id, input.type, input.summary.trim(), actor, now);
    const changes: Record<string, unknown> = { updatedAt: now };
    if (isContactActivity(input.type)) {
      changes.lastContact = bogotaDay();
      if (current.stage === "new") {
        changes.stage = "contacted";
        changes.stageChangedAt = now;
        await insertActivity(tx, id, "stage_change", `Nuevo → Contactado (automático por ${typeLabel.toLowerCase()})`, actor, new Date(now.getTime() + 1));
      }
    }
    if (input.nextFollowUp !== undefined) changes.nextFollowUp = input.nextFollowUp;
    if (input.type !== "note") await claimIfUnowned(tx, id, current.owner, actor, changes, now);
    await tx.update(leads).set(changes).where(eq(leads.id, id));
  });
}

// ── Máquina de ventas ────────────────────────────────────────────────────────

const PIPELINE_COLUMN_LIMIT = 60;
const pipelineCard = { id: leads.id, name: leads.name, organization: leads.organization, city: leads.city, phone: leads.phone, email: leads.email, source: leads.source, stage: leads.stage, priority: leads.priority, owner: leads.owner, estimatedValueInCents: leads.estimatedValueInCents, lastContact: leads.lastContact, nextFollowUp: leads.nextFollowUp, stageChangedAt: leads.stageChangedAt };
export type PipelineCard = { [K in keyof typeof pipelineCard]: Lead[K] };

/**
 * Tablero del embudo. En "Nuevo" solo aparecen los contactos entrantes (formularios, redes, registros a mano):
 * la base de prospección se trabaja desde la cola de prospección. Ganados y perdidos muestran los últimos 60 días.
 */
export async function getPipeline(filters: { owner?: string } = {}) {
  const db = getDb();
  const since = new Date(Date.now() - 60 * 86_400_000);
  const owner = filters.owner === "none" ? isNull(leads.owner) : filters.owner ? eq(leads.owner, filters.owner) : undefined;
  const columnQuery = (stage: LeadStage) => {
    const scope = stage === "new" ? not(isProspect) : stage === "won" || stage === "lost" ? gte(leads.stageChangedAt, since) : undefined;
    return db.select(pipelineCard).from(leads).where(and(eq(leads.stage, stage), scope, owner))
      .orderBy(priorityOrder, sql`${leads.nextFollowUp} is null`, asc(leads.nextFollowUp), desc(leads.updatedAt)).limit(PIPELINE_COLUMN_LIMIT);
  };
  const [cards, totals] = await Promise.all([
    Promise.all(leadStages.map(({ value }) => columnQuery(value))),
    db.select({ stage: leads.stage, prospect: sql<number>`${isProspect}`, total: count(), value: sum(leads.estimatedValueInCents) }).from(leads).where(owner).groupBy(leads.stage, sql`${isProspect}`),
  ]);
  return {
    columns: leadStages.map(({ value, label }, index) => {
      const rows = totals.filter((row) => row.stage === value && (value !== "new" || !Number(row.prospect)));
      return { stage: value, label, cards: cards[index] as PipelineCard[], total: rows.reduce((acc, row) => acc + row.total, 0), valueInCents: rows.reduce((acc, row) => acc + Number(row.value ?? 0), 0) };
    }),
    prospects: totals.filter((row) => row.stage === "new" && Number(row.prospect)).reduce((acc, row) => acc + row.total, 0),
  };
}

export async function getSalesMetrics() {
  const db = getDb();
  const monthStart = bogotaMonthStart();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const today = bogotaDay();
  const [[open], [won], [lost], [closedAll], [due], [inbound], [prospects], [touches]] = await Promise.all([
    db.select({ total: count(), value: sum(leads.estimatedValueInCents) }).from(leads).where(inArray(leads.stage, ["contacted", "meeting", "proposal"])),
    db.select({ total: count(), value: sum(leads.estimatedValueInCents) }).from(leads).where(and(eq(leads.stage, "won"), gte(leads.stageChangedAt, monthStart))),
    db.select({ total: count() }).from(leads).where(and(eq(leads.stage, "lost"), gte(leads.stageChangedAt, monthStart))),
    db.select({ won: sql<number>`sum(case when ${leads.stage} = 'won' then 1 else 0 end)`, lost: sql<number>`sum(case when ${leads.stage} = 'lost' then 1 else 0 end)` }).from(leads),
    db.select({ total: count() }).from(leads).where(dueCondition(today)),
    db.select({ total: count() }).from(leads).where(and(eq(leads.stage, "new"), not(isProspect))),
    db.select({ total: count() }).from(leads).where(and(eq(leads.stage, "new"), isProspect)),
    db.select({ total: count() }).from(leadActivities).where(and(inArray(leadActivities.type, workActivityTypes), gte(leadActivities.createdAt, weekAgo))),
  ]);
  const closed = Number(closedAll?.won ?? 0) + Number(closedAll?.lost ?? 0);
  return {
    pipeline: { open: open.total, valueInCents: Number(open.value ?? 0) },
    wonThisMonth: { total: won.total, valueInCents: Number(won.value ?? 0) },
    lostThisMonth: lost.total,
    winRate: closed ? Math.round((Number(closedAll.won) / closed) * 100) : null,
    dueFollowUps: due.total,
    inboundNew: inbound.total,
    prospectsUntouched: prospects.total,
    touchesThisWeek: touches.total,
  };
}

const agendaCard = { ...pipelineCard, notes: leads.notes };

/** Seguimientos vencidos, de hoy y de los próximos 7 días. */
export async function getAgenda(limit = 40, filters: { owner?: string } = {}) {
  return getDb().select(agendaCard).from(leads)
    .where(and(inArray(leads.stage, openLeadStages), lte(leads.nextFollowUp, bogotaDay(7)), ownerCondition(filters.owner)))
    .orderBy(asc(leads.nextFollowUp), priorityOrder).limit(limit);
}

const attemptsSubquery = sql<number>`(select count(*) from ${leadActivities} where ${leadActivities.leadId} = ${leads.id} and ${leadActivities.type} = 'attempt')`;
const queueCondition = (filters: { owner?: string; city?: string }, today = bogotaDay()) =>
  and(eq(leads.stage, "new"), isProspect, isNull(leads.lastContact), or(isNull(leads.nextFollowUp), lte(leads.nextFollowUp, today)), ownerCondition(filters.owner), cityCondition(filters.city));

export type ProspectCard = PipelineCard & { website: string | null; externalId: string | null; notes: string; attempts: number };

/**
 * Cola de prospección: colegios de la base nunca contactados y sin un reintento programado a futuro.
 * Prioridad alta primero, luego los que tienen celular (WhatsApp), luego los que tienen algún teléfono, luego los más antiguos.
 */
export async function getProspectQueue(limit = 8, filters: { owner?: string; city?: string } = {}) {
  const db = getDb();
  const condition = queueCondition(filters);
  const [rows, [total]] = await Promise.all([
    db.select({ ...pipelineCard, website: leads.website, externalId: leads.externalId, notes: leads.notes, attempts: attemptsSubquery }).from(leads).where(condition)
      .orderBy(priorityOrder, sql`${leads.phone} not glob '*3[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]*'`, sql`${leads.phone} is null or ${leads.phone} = ''`, asc(leads.createdAt), asc(leads.organization)).limit(limit),
    db.select({ value: count() }).from(leads).where(condition),
  ]);
  return { rows: rows.map((row) => ({ ...row, attempts: Number(row.attempts) })) as ProspectCard[], total: total.value };
}

// ── Resultados de prospección y acciones masivas ─────────────────────────────

export type OutcomeInput = { outcome: Outcome; channel: ContactChannel; note?: string; nextFollowUp?: string | null; lostReason?: string | null };

/**
 * Registra en un solo paso el resultado de una gestión: la actividad, la etapa que corresponde y el seguimiento.
 * - Contestó: pasa un lead nuevo a Contactado y programa el seguimiento (por defecto en 3 días).
 * - Reunión: pasa a Reunión con la fecha acordada como seguimiento.
 * - Sin respuesta: queda como intento y vuelve a la cola en 2 días; al tercer intento se sugiere marcarlo perdido.
 * - No interesa / datos errados: pasa a Perdido con el motivo.
 */
export async function recordOutcome(id: string, input: OutcomeInput, actor: string | null) {
  return getDb().transaction(async (tx) => {
    const [current] = await tx.select({ stage: leads.stage, owner: leads.owner }).from(leads).where(eq(leads.id, id)).limit(1);
    if (!current) throw new DomainError("La oportunidad no existe.", 404);
    if (current.stage === "won") throw new DomainError("Esta oportunidad ya está ganada.");
    const now = new Date();
    const today = bogotaDay();
    const channelLabel = activityTypes.find((type) => type.value === input.channel)?.label ?? input.channel;
    const note = input.note?.trim() ?? "";
    const changes: Record<string, unknown> = { updatedAt: now };
    let stage: LeadStage | null = null;
    let activityType: string = input.channel;
    let summary = "";

    switch (input.outcome) {
      case "answered":
        summary = `${channelLabel}: contestó, interesado.${note ? ` ${note}` : ""}`;
        changes.lastContact = today;
        changes.nextFollowUp = input.nextFollowUp ?? bogotaDay(3);
        if (current.stage === "new") stage = "contacted";
        break;
      case "meeting":
        if (!input.nextFollowUp) throw new DomainError("Indica la fecha de la reunión.", 400);
        summary = `${channelLabel}: reunión agendada para el ${input.nextFollowUp}.${note ? ` ${note}` : ""}`;
        changes.lastContact = today;
        changes.nextFollowUp = input.nextFollowUp;
        if (["new", "contacted"].includes(current.stage)) stage = "meeting";
        break;
      case "no_answer": {
        activityType = "attempt";
        const [{ attempts }] = await tx.select({ attempts: count() }).from(leadActivities).where(and(eq(leadActivities.leadId, id), eq(leadActivities.type, "attempt")));
        const nth = Number(attempts) + 1;
        summary = `${channelLabel} sin respuesta (intento ${nth}).${note ? ` ${note}` : ""}`;
        changes.nextFollowUp = input.nextFollowUp ?? bogotaDay(2);
        if (nth >= MAX_ATTEMPTS) summary += ` Ya son ${nth} intentos: considera marcarlo como perdido.`;
        break;
      }
      case "not_interested":
        summary = `${channelLabel}: no le interesa.${note ? ` ${note}` : ""}`;
        changes.lastContact = today;
        changes.nextFollowUp = null;
        changes.lostReason = input.lostReason?.trim() || "No es el momento";
        stage = "lost";
        break;
      case "wrong_data":
        activityType = "note";
        summary = `Datos de contacto errados (${channelLabel}).${note ? ` ${note}` : ""}`;
        changes.nextFollowUp = null;
        changes.lostReason = "Datos de contacto errados";
        stage = "lost";
        break;
    }

    await insertActivity(tx, id, activityType, summary, actor, now);
    if (stage && stage !== current.stage) {
      changes.stage = stage;
      changes.stageChangedAt = now;
      await insertActivity(tx, id, "stage_change", `${leadStageLabel(current.stage)} → ${leadStageLabel(stage)}${changes.lostReason ? ` · Motivo: ${changes.lostReason}` : ""}`, actor, new Date(now.getTime() + 1));
    }
    if (stage !== "lost") await claimIfUnowned(tx, id, current.owner, actor, changes, now);
    await tx.update(leads).set(changes).where(eq(leads.id, id));
    return { stage: stage ?? current.stage, nextFollowUp: (changes.nextFollowUp as string | null | undefined) ?? null };
  });
}

export type BulkLeadPatch = { owner?: string | null; priority?: LeadPriority; nextFollowUp?: string | null };

/** Cambios en lote desde la tabla del CRM (asignar responsable, prioridad, programar seguimiento). */
export async function bulkUpdateLeads(ids: string[], patch: BulkLeadPatch, actor: string | null) {
  const db = getDb();
  const now = new Date();
  const changes: Record<string, unknown> = { updatedAt: now };
  if (patch.owner !== undefined) changes.owner = patch.owner?.trim() || null;
  if (patch.priority) changes.priority = patch.priority;
  if (patch.nextFollowUp !== undefined) changes.nextFollowUp = patch.nextFollowUp;
  if (Object.keys(changes).length === 1) throw new DomainError("No hay cambios que aplicar.", 400);
  const targets = patch.owner !== undefined
    ? await db.select({ id: leads.id }).from(leads).where(and(inArray(leads.id, ids), changes.owner ? sql`${leads.owner} is not ${changes.owner}` : sql`${leads.owner} is not null`))
    : [];
  const result = await db.update(leads).set(changes).where(inArray(leads.id, ids));
  if (targets.length) {
    const summary = changes.owner ? `Responsable: ${changes.owner} (asignación en lote)` : "Se quitó el responsable (en lote).";
    for (let index = 0; index < targets.length; index += 100) {
      await db.insert(leadActivities).values(targets.slice(index, index + 100).map((row) => ({ id: crypto.randomUUID(), leadId: row.id, type: "assignment", summary, createdBy: actor, createdAt: now })));
    }
  }
  return { updated: result.rowsAffected };
}

// ── Rendimiento ──────────────────────────────────────────────────────────────

/** Rendimiento por asesor (según responsable del contacto), por canal de origen y motivos de pérdida. */
export async function getTeamStats() {
  const db = getDb();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const monthAgo = new Date(Date.now() - 30 * 86_400_000);
  const ownerKey = sql<string>`coalesce(nullif(${leads.owner}, ''), '—')`;
  const channelKey = sql<string>`case when instr(${leads.source}, ' / ') > 0 then substr(${leads.source}, 1, instr(${leads.source}, ' / ') - 1) else ${leads.source} end`;
  const [byOwner, touchesByOwner, bySource, lostReasons] = await Promise.all([
    db.select({
      owner: ownerKey, assigned: count(),
      open: sql<number>`sum(case when ${leads.stage} in ('contacted','meeting','proposal') then 1 else 0 end)`,
      value: sql<number>`sum(case when ${leads.stage} in ('contacted','meeting','proposal') then ${leads.estimatedValueInCents} else 0 end)`,
      won30: sql<number>`sum(case when ${leads.stage} = 'won' and ${leads.stageChangedAt} >= ${monthAgo.getTime()} then 1 else 0 end)`,
      wonValue30: sql<number>`sum(case when ${leads.stage} = 'won' and ${leads.stageChangedAt} >= ${monthAgo.getTime()} then ${leads.estimatedValueInCents} else 0 end)`,
      lost30: sql<number>`sum(case when ${leads.stage} = 'lost' and ${leads.stageChangedAt} >= ${monthAgo.getTime()} then 1 else 0 end)`,
      due: sql<number>`sum(case when ${leads.stage} in ('new','contacted','meeting','proposal') and ${leads.nextFollowUp} <= ${bogotaDay()} then 1 else 0 end)`,
    }).from(leads).where(sql`${leads.owner} is not null and ${leads.owner} <> ''`).groupBy(ownerKey),
    db.select({ owner: ownerKey, week: sql<number>`sum(case when ${leadActivities.createdAt} >= ${weekAgo.getTime()} then 1 else 0 end)`, month: count() })
      .from(leadActivities).innerJoin(leads, eq(leads.id, leadActivities.leadId))
      .where(and(inArray(leadActivities.type, workActivityTypes), gte(leadActivities.createdAt, monthAgo), sql`${leads.owner} is not null and ${leads.owner} <> ''`)).groupBy(ownerKey),
    db.select({
      source: channelKey, total: count(),
      open: sql<number>`sum(case when ${leads.stage} in ('contacted','meeting','proposal') then 1 else 0 end)`,
      won: sql<number>`sum(case when ${leads.stage} = 'won' then 1 else 0 end)`,
      lost: sql<number>`sum(case when ${leads.stage} = 'lost' then 1 else 0 end)`,
    }).from(leads).groupBy(channelKey).orderBy(desc(count())),
    db.select({ reason: sql<string>`coalesce(${leads.lostReason}, 'Sin motivo')`, total: count() }).from(leads).where(eq(leads.stage, "lost")).groupBy(leads.lostReason).orderBy(desc(count())).limit(10),
  ]);
  const touches = new Map(touchesByOwner.map((row) => [row.owner, row]));
  return {
    owners: byOwner.map((row) => ({ owner: row.owner, assigned: row.assigned, open: Number(row.open), valueInCents: Number(row.value), won30: Number(row.won30), wonValueInCents30: Number(row.wonValue30), lost30: Number(row.lost30), due: Number(row.due), touchesWeek: Number(touches.get(row.owner)?.week ?? 0), touchesMonth: Number(touches.get(row.owner)?.month ?? 0) }))
      .sort((a, b) => b.touchesWeek - a.touchesWeek || b.open - a.open),
    sources: bySource.map((row) => ({ source: row.source, label: leadSourceLabel(row.source), total: row.total, open: Number(row.open), won: Number(row.won), lost: Number(row.lost), winRate: Number(row.won) + Number(row.lost) ? Math.round((Number(row.won) / (Number(row.won) + Number(row.lost))) * 100) : null })),
    lostReasons: lostReasons.map((row) => ({ reason: row.reason, total: row.total })),
  };
}

// ── Importación y exportación CSV ────────────────────────────────────────────

export const leadCsvHeader = ["institucion", "contacto", "correo", "telefono", "ciudad", "sitio_web", "codigo_dane", "origen", "etapa", "prioridad", "responsable", "valor_estimado_cop", "ultimo_contacto", "proximo_seguimiento", "mensaje", "notas", "creado"];

export async function exportLeads(filters: LeadFilters) {
  const rows = await getDb().select().from(leads).where(leadCondition(filters)).orderBy(asc(leads.organization)).limit(50_000);
  return rows.map((lead) => [
    lead.organization, lead.name, lead.email, lead.phone, lead.city, lead.website, lead.externalId, lead.source, leadStageLabel(lead.stage), leadPriorities.find((p) => p.value === lead.priority)?.label ?? lead.priority, lead.owner,
    lead.estimatedValueInCents ? Math.round(lead.estimatedValueInCents / 100) : "", lead.lastContact, lead.nextFollowUp, lead.message, lead.notes, lead.createdAt.toISOString().slice(0, 10),
  ]);
}

const pick = (record: Record<string, string>, ...keys: string[]) => keys.map((key) => record[key]).find((value) => value !== undefined && value !== "") ?? "";
const fromLabel = <T extends string>(list: readonly { value: T; label: string }[], raw: string, fallback: T) => {
  const value = raw.trim().toLowerCase();
  return list.find((item) => item.value === value || item.label.toLowerCase() === value)?.value ?? fallback;
};
const isoDay = (value: string) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);

/**
 * Importa contactos desde un CSV (el mismo formato que exporta el panel, o columnas equivalentes como
 * `colegio`, `email`, `municipio`, `dane`). No duplica: omite filas cuyo código DANE ya existe (o, sin código, cuyo correo ya existe).
 */
export async function importLeads(records: Record<string, string>[]) {
  const db = getDb();
  const existing = await db.select({ email: leads.email, externalId: leads.externalId }).from(leads);
  const emails = new Set(existing.map((row) => row.email?.toLowerCase()).filter(Boolean));
  const externalIds = new Set(existing.map((row) => row.externalId).filter(Boolean));
  const now = new Date();
  const values: ReturnType<typeof leadValues>[] = [];
  let skipped = 0, invalid = 0;
  for (const record of records) {
    const organization = pick(record, "institucion", "organizacion", "organization", "colegio", "empresa").slice(0, 160);
    if (organization.length < 2) { invalid++; continue; }
    const email = pick(record, "correo", "email", "correo_electronico").toLowerCase().slice(0, 180);
    const externalId = pick(record, "codigo_dane", "dane", "external_id", "id_externo").slice(0, 60) || null;
    // Con código DANE se deduplica solo por código: varias sedes de un colegio comparten correo.
    if (externalId ? externalIds.has(externalId) : !!email && emails.has(email)) { skipped++; continue; }
    const rawSource = pick(record, "origen", "source", "canal");
    const source = leadSourceValues.some((value) => rawSource === value || rawSource.startsWith(`${value} / `)) ? rawSource.slice(0, 80) : "import";
    const value = leadValues({
      organization, name: pick(record, "contacto", "nombre", "name", "rector", "responsable_institucion").slice(0, 120) || "Equipo directivo",
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null, phone: pick(record, "telefono", "celular", "phone", "telefonos").slice(0, 60), city: pick(record, "ciudad", "municipio", "city").slice(0, 100),
      website: pick(record, "sitio_web", "website", "web").slice(0, 300), externalId, source,
      message: pick(record, "mensaje", "necesidad", "message").slice(0, 2000) || "Contacto importado desde CSV.", notes: pick(record, "notas", "notes", "observaciones").slice(0, 4000),
      priority: fromLabel(leadPriorities, pick(record, "prioridad", "priority"), "medium"), owner: pick(record, "responsable", "owner", "asesor").slice(0, 120),
      estimatedValueInCents: Math.max(0, Math.round(Number(pick(record, "valor_estimado_cop", "valor_estimado", "valor").replace(/[^\d.]/g, "")) || 0)) * 100,
      nextFollowUp: isoDay(pick(record, "proximo_seguimiento", "next_follow_up")),
    }, now);
    const stage = fromLabel(leadStages, pick(record, "etapa", "stage"), "new");
    values.push({ ...value, stage, ...(isoDay(pick(record, "ultimo_contacto", "last_contact")) && { lastContact: isoDay(pick(record, "ultimo_contacto", "last_contact")) }) } as typeof value);
    if (email) emails.add(email);
    if (externalId) externalIds.add(externalId);
  }
  for (let index = 0; index < values.length; index += 100) {
    await db.insert(leads).values(values.slice(index, index + 100)).onConflictDoNothing();
  }
  return { created: values.length, skipped, invalid };
}
