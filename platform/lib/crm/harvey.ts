import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, like, ne, notInArray, notLike, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { leadActivities, leads, settings } from "@/db/schema";
import { leadStageLabel } from "@/lib/crm/constants";
import { refreshScore } from "@/lib/crm/leads";
import { bogotaDay } from "@/lib/format";

/**
 * Integración con Harvey, el agente de prospección por correo que corre en el equipo del asesor.
 *
 * Harvey pide colegios listos para outbound (`listOutboundCandidates`) y devuelve lo que pasó con cada uno
 * (`applyHarveyEvents`): se lo entregaron, le escribió, respondió, pidió reunión, se dio de baja o rebotó.
 * Cada evento queda como actividad con un id determinístico (`hv:<tipo>:<clave>`), así que reenviar el mismo
 * evento no duplica nada en la ficha. La respuesta en bruto ("Correo recibido") la sigue registrando la captación
 * del buzón del CRM; Harvey solo añade su clasificación. Una baja pedida a Harvey usa el mismo campo que `/baja/[token]`
 * (`marketingOptOutAt`): el compositor del CRM la bloquea y Harvey no vuelve a recibir ese colegio.
 *
 * Variable: HARVEY_SYNC_TOKEN (24+ caracteres), que Harvey envía como `Authorization: Bearer <token>`.
 */

const ACTOR = "Harvey";
const digest = (value: string) => createHash("sha256").update(value).digest();

export function harveyAuthorized(request: Request) {
  const secret = process.env.HARVEY_SYNC_TOKEN;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return Boolean(secret && token && secret.length >= 24 && timingSafeEqual(digest(secret), digest(token)));
}

/** Eventos que se registran una sola vez por colegio (no por correo): su id depende solo del colegio. */
const perLeadTypes = new Set(["enqueued", "skipped"]);

export type OutboundFilters = { limit: number; cities: string[]; requireWebsite: boolean };

/** Colegios en etapa "Nuevo", con correo, sin baja de comunicaciones, que Harvey todavía no ha tomado ni descartado. */
const candidateConditions = () => [
  eq(leads.stage, "new"),
  isNotNull(leads.email),
  ne(leads.email, ""),
  isNull(leads.marketingOptOutAt),
  sql`not exists (select 1 from lead_activities where lead_activities.id in ('hv:enqueued:' || ${leads.id}, 'hv:skipped:' || ${leads.id}))`,
];

export async function listOutboundCandidates({ limit, cities, requireWebsite }: OutboundFilters) {
  const conditions = candidateConditions();
  if (cities.length) conditions.push(inArray(leads.city, cities));
  if (requireWebsite) conditions.push(isNotNull(leads.website), ne(leads.website, ""));
  return getDb().select({
    id: leads.id, organization: leads.organization, name: leads.name, decisionMaker: leads.decisionMaker, email: leads.email,
    phone: leads.phone, city: leads.city, website: leads.website, students: leads.students, grades: leads.grades,
    program: leads.program, painPoints: leads.painPoints, competitors: leads.competitors, message: leads.message,
    techLevel: leads.techLevel, sector: leads.sector, budgetRange: leads.budgetRange,
  }).from(leads).where(and(...conditions)).orderBy(desc(leads.score), asc(leads.createdAt)).limit(limit);
}

export const harveyEventTypes = ["enqueued", "skipped", "sent", "reply", "meeting", "optout", "bounce", "invalid_email"] as const;

export type HarveyEvent = {
  /** Única por evento dentro de Harvey (id del correo en el outbox, de la conversación, del prospecto…). */
  key: string;
  type: (typeof harveyEventTypes)[number];
  /** Id del colegio en el CRM. Si no existe (p. ej. una copia vieja), se busca por `email`. */
  leadId?: string | null;
  email?: string | null;
  at?: string | null;
  subject?: string | null;
  step?: number | null;
  intent?: string | null;
  excerpt?: string | null;
};

export type HarveyEventResult = { key: string; status: "applied" | "duplicate" | "not_found" | "error"; leadId?: string };

const intentLabels: Record<string, string> = {
  interested: "interesado", question: "pregunta", objection: "objeción", not_interested: "no le interesa",
  unsubscribe: "pide no recibir más", opt_out: "pide no recibir más", out_of_office: "fuera de oficina",
};
const intentLabel = (intent?: string | null) => (intent ? intentLabels[intent] ?? intent : "sin clasificar");

const replyNextAction: Record<string, string> = {
  interested: "Responder y agendar la demostración (respondió con interés)",
  question: "Responder la pregunta del colegio",
  objection: "Atender la objeción del colegio",
  not_interested: "Revisar: respondió que no le interesa",
};

const quote = (text?: string | null, max = 160) => {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  return clean ? `«${clean.length > max ? `${clean.slice(0, max - 1)}…` : clean}»` : "";
};

function describe(event: HarveyEvent): { type: string; summary: string } {
  switch (event.type) {
    case "enqueued": return { type: "note", summary: "Enviado a Harvey: prospección automática por correo (los envíos esperan aprobación)." };
    case "skipped": return { type: "note", summary: `Harvey no lo tomó para prospección automática${event.excerpt ? `: ${event.excerpt.trim()}` : "."}` };
    case "sent": return { type: "email", summary: `Harvey envió el correo ${event.step ?? 1} de la secuencia${event.subject ? `: ${quote(event.subject, 120)}` : ""}.` };
    case "reply": return { type: "note", summary: `Respondió a Harvey (intención: ${intentLabel(event.intent)})${event.excerpt ? `: ${quote(event.excerpt)}` : ""}.` };
    case "meeting": return { type: "note", summary: "Harvey: el colegio pidió o aceptó una reunión." };
    case "optout": return { type: "note", summary: "Pidió no recibir más correos. Harvey lo dejó en la lista de no contacto." };
    case "bounce": return { type: "note", summary: `El correo ${event.email ?? ""} rebotó; Harvey detuvo la secuencia.`.replace("  ", " ") };
    case "invalid_email": return { type: "note", summary: `La verificación marcó el correo ${event.email ?? ""} como inválido; Harvey no le escribirá.`.replace("  ", " ") };
  }
}

function eventDate(at?: string | null) {
  const date = at ? new Date(at) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

async function findLead(event: HarveyEvent) {
  const db = getDb();
  if (event.leadId) {
    const [row] = await db.select({ id: leads.id }).from(leads).where(eq(leads.id, event.leadId)).limit(1);
    if (row) return row.id;
  }
  if (event.email) {
    const [row] = await db.select({ id: leads.id }).from(leads).where(eq(sql`lower(${leads.email})`, event.email.trim().toLowerCase())).limit(1);
    if (row) return row.id;
  }
  return null;
}

async function applyOne(event: HarveyEvent): Promise<HarveyEventResult> {
  const leadId = await findLead(event);
  if (!leadId) return { key: event.key, status: "not_found" };
  const activityId = perLeadTypes.has(event.type) ? `hv:${event.type}:${leadId}` : `hv:${event.type}:${event.key}`;
  const { type, summary } = describe(event);
  const at = eventDate(event.at);

  return getDb().transaction(async (tx) => {
    const inserted = await tx.insert(leadActivities)
      .values({ id: activityId, leadId, type, summary, createdBy: ACTOR, createdAt: at })
      .onConflictDoNothing().returning({ id: leadActivities.id });
    if (!inserted.length) return { key: event.key, status: "duplicate", leadId };

    const [current] = await tx.select({ stage: leads.stage }).from(leads).where(eq(leads.id, leadId)).limit(1);
    const now = new Date();
    const changes: Record<string, unknown> = { updatedAt: now };
    let moveTo: string | null = null;

    switch (event.type) {
      case "sent":
        changes.lastContact = bogotaDay();
        if (current.stage === "new") moveTo = "contacted";
        break;
      case "reply":
        changes.lastContact = bogotaDay();
        changes.nextAction = replyNextAction[event.intent ?? ""] ?? "Revisar la respuesta del colegio";
        changes.nextFollowUp = bogotaDay();
        if (current.stage === "new") moveTo = "contacted";
        break;
      case "meeting":
        if (current.stage === "new" || current.stage === "contacted") moveTo = "meeting";
        break;
      case "optout":
        // Nadie debe volver a escribirle: baja de comunicaciones (como `/baja/[token]`) y sin "responder" pendiente.
        changes.marketingOptOutAt = now;
        changes.nextAction = null;
        changes.nextFollowUp = null;
        if (current.stage !== "won" && current.stage !== "lost") {
          moveTo = "lost";
          changes.lostReason = "Pidió no recibir más correos (baja registrada por Harvey).";
        }
        break;
      case "bounce":
      case "invalid_email":
        changes.nextAction = "Conseguir un correo válido del colegio";
        break;
    }

    if (moveTo && moveTo !== current.stage) {
      changes.stage = moveTo;
      changes.stageChangedAt = now;
      await tx.insert(leadActivities).values({
        id: `${activityId}:stage`, leadId, type: "stage_change", createdBy: ACTOR, createdAt: new Date(now.getTime() + 1),
        summary: `${leadStageLabel(current.stage)} → ${leadStageLabel(moveTo)} (automático por Harvey)`,
      }).onConflictDoNothing();
    }
    await tx.update(leads).set(changes).where(eq(leads.id, leadId));
    await refreshScore(tx, leadId);
    return { key: event.key, status: "applied", leadId };
  });
}

// ── Estado para el panel (/admin/harvey) ─────────────────────────────────────

/** Resumen que Harvey manda al final de cada sincronización: solo conteos de su base local, sin datos de los colegios. */
export type HarveySnapshot = {
  prospects: number; verified: number; pendingVerification: number; risky: number; invalid: number;
  outboxPending: number; outboxApproved: number; sent: number; sendingPaused: boolean; lastCycleAt: string | null;
};
export type HarveySync = { lastRequestAt: string; lastRequest: "leads" | "events" | "status"; snapshot?: HarveySnapshot & { at: string } };

const SYNC_KEY = "harvey.sync";

async function readSync(): Promise<HarveySync | null> {
  const [row] = await getDb().select({ value: settings.value }).from(settings).where(eq(settings.key, SYNC_KEY)).limit(1);
  try { return row ? JSON.parse(row.value) as HarveySync : null; } catch { return null; }
}

/** Anota cada llamada autorizada de Harvey; el panel la usa para saber si la sincronización programada sigue viva. */
export async function recordHarveyContact(kind: HarveySync["lastRequest"], snapshot?: HarveySnapshot) {
  try {
    const now = new Date();
    const previous = await readSync();
    const next: HarveySync = { lastRequestAt: now.toISOString(), lastRequest: kind, snapshot: snapshot ? { ...snapshot, at: now.toISOString() } : previous?.snapshot };
    const value = JSON.stringify(next);
    await getDb().insert(settings).values({ key: SYNC_KEY, value, updatedAt: now }).onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: now } });
  } catch (error) {
    console.error("harvey_sync_record_failed", error);
  }
}

export type HarveyEventKind = HarveyEvent["type"];
const kindOf = (activityId: string) => activityId.split(":")[1] as HarveyEventKind;

/** Todo lo que el panel muestra de Harvey: conexión, totales por tipo de evento, colegios por atender y actividad reciente. */
export async function getHarveyOverview() {
  const db = getDb();
  const ownEvents = and(like(leadActivities.id, "hv:%"), notLike(leadActivities.id, "%:stage"));
  const inHarvey = sql`exists (select 1 from lead_activities where lead_activities.id = 'hv:enqueued:' || ${leads.id})`;

  const [totals, pendingByCity, stages, recent, toAttend, sync] = await Promise.all([
    db.select({ kind: sql<string>`substr(${leadActivities.id}, 4, instr(substr(${leadActivities.id}, 4), ':') - 1)`, total: count() })
      .from(leadActivities).where(ownEvents).groupBy(sql`1`),
    db.select({ city: leads.city, total: count() }).from(leads).where(and(...candidateConditions())).groupBy(leads.city).orderBy(desc(count())),
    db.select({ stage: leads.stage, total: count() }).from(leads).where(inHarvey).groupBy(leads.stage),
    db.select({ id: leadActivities.id, summary: leadActivities.summary, at: leadActivities.createdAt, leadId: leads.id, organization: leads.organization, city: leads.city })
      .from(leadActivities).innerJoin(leads, eq(leads.id, leadActivities.leadId))
      .where(and(ownEvents, notLike(leadActivities.id, "hv:enqueued:%"))).orderBy(desc(leadActivities.createdAt)).limit(25),
    db.select({ leadId: leads.id, organization: leads.organization, city: leads.city, nextAction: leads.nextAction, nextFollowUp: leads.nextFollowUp })
      .from(leads).where(and(
        sql`exists (select 1 from lead_activities where lead_activities.lead_id = ${leads.id} and lead_activities.id like 'hv:reply:%')`,
        isNotNull(leads.nextFollowUp), notInArray(leads.stage, ["won", "lost"]),
      )).orderBy(asc(leads.nextFollowUp)).limit(15),
    readSync(),
  ]);

  const counts = Object.fromEntries(harveyEventTypes.map((kind) => [kind, 0])) as Record<HarveyEventKind, number>;
  for (const row of totals) if (row.kind in counts) counts[row.kind as HarveyEventKind] = Number(row.total);

  return {
    configured: (process.env.HARVEY_SYNC_TOKEN ?? "").length >= 24,
    sync,
    counts,
    pending: { total: pendingByCity.reduce((sum, row) => sum + Number(row.total), 0), byCity: pendingByCity.map((row) => ({ city: row.city || "Sin ciudad", total: Number(row.total) })) },
    stages: stages.map((row) => ({ stage: row.stage, total: Number(row.total) })),
    recent: recent.map((row) => ({ ...row, kind: kindOf(row.id) })),
    toAttend,
  };
}

export type HarveyOverview = Awaited<ReturnType<typeof getHarveyOverview>>;

/** Aplica los eventos uno a uno; un error en uno no frena a los demás. */
export async function applyHarveyEvents(events: HarveyEvent[]) {
  const results: HarveyEventResult[] = [];
  for (const event of events) {
    try {
      results.push(await applyOne(event));
    } catch (error) {
      console.error("harvey_event_failed", event.type, event.key, error);
      results.push({ key: event.key, status: "error" });
    }
  }
  return results;
}
