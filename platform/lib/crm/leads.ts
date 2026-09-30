import "server-only";
import { and, asc, count, desc, eq, gte, inArray, isNull, like, lte, not, or, sql, sum, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { leadActivities, leads, orders } from "@/db/schema";
import { bogotaDay, bogotaMonthStart } from "@/lib/format";
import { DomainError } from "@/lib/http";
import {
  PROSPECT_SOURCE, activityTypes, isContactActivity, leadPriorities, leadPriorityValues, leadSourceValues, leadStageLabel, leadStages, leadStageValues, openLeadStages,
  type ActivityType, type LeadPriority, type LeadStage,
} from "@/lib/crm/constants";

export type Lead = typeof leads.$inferSelect;
export type LeadActivity = typeof leadActivities.$inferSelect;
type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export const LEADS_PAGE_SIZE = 40;

// ── Consultas ────────────────────────────────────────────────────────────────

export type LeadFilters = { search?: string; stage?: string; priority?: string; source?: string; owner?: string; due?: boolean };

export function leadFiltersFrom(params: URLSearchParams): LeadFilters {
  return { search: params.get("search") ?? "", stage: params.get("stage") ?? "", priority: params.get("priority") ?? "", source: params.get("source") ?? "", owner: params.get("owner") ?? "", due: params.get("due") === "1" };
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
    filters.owner === "none" ? isNull(leads.owner) : filters.owner ? eq(leads.owner, filters.owner.slice(0, 120)) : undefined,
    filters.due ? dueCondition() : undefined,
  );
}

export async function listLeads(filters: LeadFilters, page = 1) {
  const db = getDb();
  const condition = leadCondition(filters);
  const [rows, [total], [all], [due], [fresh], owners] = await Promise.all([
    db.select().from(leads).where(condition).orderBy(priorityOrder, desc(leads.updatedAt)).limit(LEADS_PAGE_SIZE).offset((page - 1) * LEADS_PAGE_SIZE),
    db.select({ value: count() }).from(leads).where(condition),
    db.select({ value: count() }).from(leads),
    db.select({ value: count() }).from(leads).where(dueCondition()),
    db.select({ value: count() }).from(leads).where(eq(leads.stage, "new")),
    db.selectDistinct({ owner: leads.owner }).from(leads).where(sql`${leads.owner} is not null and ${leads.owner} <> ''`).orderBy(asc(leads.owner)).limit(50),
  ]);
  return { rows, page, pageSize: LEADS_PAGE_SIZE, total: total.value, metrics: { all: all.value, due: due.value, new: fresh.value }, owners: owners.map((row) => row.owner!) };
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
    const [current] = await tx.select({ stage: leads.stage }).from(leads).where(eq(leads.id, id)).limit(1);
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
  const contactTypes = activityTypes.filter((type) => type.contact).map((type) => type.value);
  const [[open], [won], [lost], [closedAll], [due], [inbound], [prospects], [touches]] = await Promise.all([
    db.select({ total: count(), value: sum(leads.estimatedValueInCents) }).from(leads).where(inArray(leads.stage, ["contacted", "meeting", "proposal"])),
    db.select({ total: count(), value: sum(leads.estimatedValueInCents) }).from(leads).where(and(eq(leads.stage, "won"), gte(leads.stageChangedAt, monthStart))),
    db.select({ total: count() }).from(leads).where(and(eq(leads.stage, "lost"), gte(leads.stageChangedAt, monthStart))),
    db.select({ won: sql<number>`sum(case when ${leads.stage} = 'won' then 1 else 0 end)`, lost: sql<number>`sum(case when ${leads.stage} = 'lost' then 1 else 0 end)` }).from(leads),
    db.select({ total: count() }).from(leads).where(dueCondition(today)),
    db.select({ total: count() }).from(leads).where(and(eq(leads.stage, "new"), not(isProspect))),
    db.select({ total: count() }).from(leads).where(and(eq(leads.stage, "new"), isProspect)),
    db.select({ total: count() }).from(leadActivities).where(and(inArray(leadActivities.type, contactTypes), gte(leadActivities.createdAt, weekAgo))),
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
export async function getAgenda(limit = 40) {
  return getDb().select(agendaCard).from(leads)
    .where(and(inArray(leads.stage, openLeadStages), lte(leads.nextFollowUp, bogotaDay(7))))
    .orderBy(asc(leads.nextFollowUp), priorityOrder).limit(limit);
}

/** Siguientes colegios de la base por contactar: prioridad alta primero, nunca contactados. */
export async function getProspectQueue(limit = 8) {
  return getDb().select(pipelineCard).from(leads)
    .where(and(eq(leads.stage, "new"), isProspect, isNull(leads.lastContact)))
    .orderBy(priorityOrder, asc(leads.createdAt), asc(leads.organization)).limit(limit);
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
