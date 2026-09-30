import "server-only";
import { and, count, desc, eq, like, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { leadActivities, leads, quotes } from "@/db/schema";
import { QUOTE_DEFAULT_TERMS as DEFAULT_TERMS, QUOTE_VALIDITY_DAYS, quoteStatusLabel, stagePlaybook, type QuoteStatus } from "@/lib/crm/constants";
import { bogotaDay } from "@/lib/format";
import { DomainError } from "@/lib/http";

export type QuoteItem = { description: string; quantity: number; unitPriceInCents: number; productSlug?: string | null };
export type QuoteInput = { title: string; items: QuoteItem[]; discountInCents?: number; validUntil?: string | null; notes?: string; terms?: string };

const totals = (items: QuoteItem[], discountInCents = 0) => {
  const subtotalInCents = items.reduce((acc, item) => acc + Math.round(item.quantity * item.unitPriceInCents), 0);
  const discount = Math.min(subtotalInCents, Math.max(0, discountInCents));
  return { subtotalInCents, discountInCents: discount, totalInCents: subtotalInCents - discount };
};
const parseItems = (raw: string): QuoteItem[] => { try { const list = JSON.parse(raw); return Array.isArray(list) ? list : []; } catch { return []; } };
const withItems = <T extends { items: string }>(row: T) => ({ ...row, items: parseItems(row.items) });

async function nextNumber(db: ReturnType<typeof getDb>) {
  const year = bogotaDay().slice(0, 4);
  const [{ total }] = await db.select({ total: count() }).from(quotes).where(like(quotes.number, `COT-${year}-%`));
  return `COT-${year}-${String(total + 1).padStart(4, "0")}`;
}

async function logOnLead(tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0], leadId: string, summary: string, actor: string | null, at = new Date()) {
  await tx.insert(leadActivities).values({ id: crypto.randomUUID(), leadId, type: "note", summary, createdBy: actor, createdAt: at });
}

export async function createQuote(leadId: string, input: QuoteInput, actor: string | null) {
  const db = getDb();
  const [lead] = await db.select({ id: leads.id, organization: leads.organization }).from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) throw new DomainError("El contacto no existe.", 404);
  if (!input.items.length) throw new DomainError("Agrega al menos un renglón a la cotización.", 400);
  const now = new Date();
  const id = crypto.randomUUID();
  const number = await nextNumber(db);
  await db.transaction(async (tx) => {
    await tx.insert(quotes).values({ id, leadId, number, status: "draft", title: input.title.trim(), items: JSON.stringify(input.items), ...totals(input.items, input.discountInCents), validUntil: input.validUntil ?? bogotaDay(QUOTE_VALIDITY_DAYS), notes: input.notes?.trim() ?? "", terms: input.terms?.trim() || DEFAULT_TERMS, token: crypto.randomUUID().replace(/-/g, ""), createdBy: actor, createdAt: now, updatedAt: now });
    await logOnLead(tx, leadId, `Cotización ${number} creada: ${input.title.trim()}.`, actor, now);
  });
  return { id, number };
}

export async function updateQuote(id: string, input: Partial<QuoteInput>, actor: string | null) {
  const db = getDb();
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
  if (!quote) throw new DomainError("La cotización no existe.", 404);
  if (!["draft", "sent"].includes(quote.status)) throw new DomainError("Una cotización aceptada o rechazada no se edita: crea una nueva versión.");
  const items = input.items ?? parseItems(quote.items);
  if (!items.length) throw new DomainError("Agrega al menos un renglón a la cotización.", 400);
  await db.update(quotes).set({
    ...(input.title !== undefined && { title: input.title.trim() }), items: JSON.stringify(items), ...totals(items, input.discountInCents ?? quote.discountInCents),
    ...(input.validUntil !== undefined && { validUntil: input.validUntil }), ...(input.notes !== undefined && { notes: input.notes.trim() }), ...(input.terms !== undefined && { terms: input.terms.trim() || DEFAULT_TERMS }), updatedAt: new Date(),
  }).where(eq(quotes.id, id));
  void actor;
}

/**
 * Cambia el estado. Enviada: la oportunidad pasa a Propuesta con seguimiento. Aceptada: la oportunidad se gana con el valor de
 * la cotización. Rechazada: queda registrado; la etapa la decide el asesor.
 */
export async function setQuoteStatus(id: string, status: QuoteStatus, actor: string | null, note = "") {
  return getDb().transaction(async (tx) => {
    const [quote] = await tx.select().from(quotes).where(eq(quotes.id, id)).limit(1);
    if (!quote) throw new DomainError("La cotización no existe.", 404);
    const allowed: Record<string, QuoteStatus[]> = { draft: ["sent", "expired"], sent: ["accepted", "rejected", "expired", "sent"], expired: ["sent"], accepted: [], rejected: ["sent"] };
    if (!allowed[quote.status]?.includes(status)) throw new DomainError(`No se puede pasar de ${quoteStatusLabel(quote.status).toLowerCase()} a ${quoteStatusLabel(status).toLowerCase()}.`);
    const now = new Date();
    const [lead] = await tx.select({ stage: leads.stage, nextFollowUp: leads.nextFollowUp }).from(leads).where(eq(leads.id, quote.leadId)).limit(1);
    await tx.update(quotes).set({ status, updatedAt: now, ...(status === "sent" && { sentAt: now }), ...((status === "accepted" || status === "rejected") && { decidedAt: now }) }).where(eq(quotes.id, id));
    const suffix = note.trim() ? ` ${note.trim()}` : "";
    if (status === "sent") {
      await logOnLead(tx, quote.leadId, `Cotización ${quote.number} enviada por $${Math.round(quote.totalInCents / 100).toLocaleString("es-CO")}.${suffix}`, actor, now);
      if (lead && ["new", "contacted", "meeting"].includes(lead.stage)) {
        await tx.update(leads).set({ stage: "proposal", stageChangedAt: now, nextAction: stagePlaybook.proposal.nextAction, nextFollowUp: bogotaDay(stagePlaybook.proposal.days), estimatedValueInCents: sql`case when ${leads.estimatedValueInCents} > 0 then ${leads.estimatedValueInCents} else ${quote.totalInCents} end`, updatedAt: now }).where(eq(leads.id, quote.leadId));
        await tx.insert(leadActivities).values({ id: crypto.randomUUID(), leadId: quote.leadId, type: "stage_change", summary: `${lead.stage === "new" ? "Nuevo" : lead.stage === "contacted" ? "Contactado" : "Reunión"} → Propuesta (cotización enviada)`, createdBy: actor, createdAt: new Date(now.getTime() + 1) });
      }
    } else if (status === "accepted") {
      await logOnLead(tx, quote.leadId, `Cotización ${quote.number} aceptada por $${Math.round(quote.totalInCents / 100).toLocaleString("es-CO")}.${suffix}`, actor, now);
      if (lead && lead.stage !== "won") {
        await tx.update(leads).set({ stage: "won", stageChangedAt: now, estimatedValueInCents: quote.totalInCents, lostReason: null, nextAction: stagePlaybook.won.nextAction, nextFollowUp: bogotaDay(stagePlaybook.won.days), lastContact: bogotaDay(), updatedAt: now }).where(eq(leads.id, quote.leadId));
        await tx.insert(leadActivities).values({ id: crypto.randomUUID(), leadId: quote.leadId, type: "stage_change", summary: `${lead.stage === "proposal" ? "Propuesta" : lead.stage === "meeting" ? "Reunión" : "Contactado"} → Ganado (cotización ${quote.number} aceptada)`, createdBy: actor, createdAt: new Date(now.getTime() + 1) });
      }
    } else if (status === "rejected") {
      await logOnLead(tx, quote.leadId, `Cotización ${quote.number} rechazada.${suffix}`, actor, now);
    } else if (status === "expired") {
      await logOnLead(tx, quote.leadId, `Cotización ${quote.number} vencida sin respuesta.`, actor, now);
    }
    return { status };
  });
}

const quoteRow = { id: quotes.id, leadId: quotes.leadId, number: quotes.number, status: quotes.status, title: quotes.title, totalInCents: quotes.totalInCents, validUntil: quotes.validUntil, token: quotes.token, createdBy: quotes.createdBy, sentAt: quotes.sentAt, decidedAt: quotes.decidedAt, createdAt: quotes.createdAt, organization: leads.organization, contact: leads.name, city: leads.city, phone: leads.phone, email: leads.email };

export async function listQuotes(filters: { status?: string; search?: string } = {}) {
  const db = getDb();
  const search = filters.search?.trim().slice(0, 80);
  const condition = and(filters.status ? eq(quotes.status, filters.status) : undefined, search ? or(like(quotes.number, `%${search}%`), like(quotes.title, `%${search}%`), like(leads.organization, `%${search}%`)) : undefined);
  const [rows, summary] = await Promise.all([
    db.select(quoteRow).from(quotes).innerJoin(leads, eq(leads.id, quotes.leadId)).where(condition).orderBy(desc(quotes.createdAt)).limit(200),
    db.select({ status: quotes.status, total: count(), value: sql<number>`sum(${quotes.totalInCents})` }).from(quotes).groupBy(quotes.status),
  ]);
  return { rows, summary: summary.map((row) => ({ status: row.status, total: row.total, valueInCents: Number(row.value ?? 0) })) };
}

export async function getQuote(id: string) {
  const [row] = await getDb().select({ quote: quotes, organization: leads.organization, contact: leads.name, email: leads.email, phone: leads.phone, city: leads.city, students: leads.students, program: leads.program }).from(quotes).innerJoin(leads, eq(leads.id, quotes.leadId)).where(eq(quotes.id, id)).limit(1);
  return row ? { ...withItems(row.quote), lead: { organization: row.organization, contact: row.contact, email: row.email, phone: row.phone, city: row.city, students: row.students, program: row.program } } : null;
}

/** Vista pública por enlace: muestra la cotización; no expone datos internos del contacto más allá de la institución y el nombre. */
export async function getQuoteByToken(token: string) {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  const [row] = await getDb().select({ quote: quotes, organization: leads.organization, contact: leads.name, city: leads.city }).from(quotes).innerJoin(leads, eq(leads.id, quotes.leadId)).where(eq(quotes.token, token)).limit(1);
  if (!row) return null;
  const quote = withItems(row.quote);
  const expired = quote.status === "sent" && !!quote.validUntil && quote.validUntil < bogotaDay();
  return { ...quote, lead: { organization: row.organization, contact: row.contact, city: row.city }, expired };
}

/** Decisión del cliente desde el enlace público. Solo cotizaciones enviadas y vigentes. */
export async function decideQuoteByToken(token: string, decision: "accepted" | "rejected", note: string) {
  const quote = await getQuoteByToken(token);
  if (!quote) throw new DomainError("La cotización no existe.", 404);
  if (quote.status !== "sent") throw new DomainError(quote.status === "accepted" ? "Esta cotización ya fue aceptada." : "Esta cotización ya no está disponible para decidir.");
  if (quote.expired) throw new DomainError("Esta cotización venció. Escríbenos y la actualizamos.");
  return setQuoteStatus(quote.id, decision, "Cliente (enlace web)", note ? `Comentario del cliente: ${note.slice(0, 500)}` : "");
}
