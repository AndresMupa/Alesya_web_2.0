import "server-only";
import { cache } from "react";
import { and, count, eq, like, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { leadActivities, leads, quotes } from "@/db/schema";
import { refreshScore } from "@/lib/crm/leads";
import { PROPOSAL_ACTIVITY, proposalReadSummary, readProposalPlan, type ProposalRead, type ProposalView } from "@/lib/crm/proposal-plan";
import type { QuoteItem } from "@/lib/crm/quotes";
import { bogotaDay, formatDay, formatMoney } from "@/lib/format";
import { renderEmail, sendMail } from "@/lib/mail";
import { storeConfig } from "@/lib/settings";

const TOKEN = /^[a-f0-9]{32}$/;
const DEFAULT_ASESOR = "Equipo comercial Alesya";
const longDate = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "long", year: "numeric" });
const dayLong = (day: string) => longDate.format(new Date(`${day}T17:00:00Z`));
const parseItems = (raw: string): QuoteItem[] => { try { const list = JSON.parse(raw); return Array.isArray(list) ? list : []; } catch { return []; } };

/**
 * Propuesta viva por enlace: la cotización (renglones, total, vigencia y estado) y del lead solo la institución,
 * la ciudad, el asesor responsable y el estudio del colegio. `cache` evita repetir la consulta entre metadatos y página.
 */
export const getProposal = cache(async (token: string): Promise<ProposalView | null> => {
  if (!TOKEN.test(token)) return null;
  const [[row], config] = await Promise.all([
    getDb().select({ quote: quotes, organization: leads.organization, city: leads.city, owner: leads.owner, students: leads.students, grades: leads.grades }).from(quotes).innerJoin(leads, eq(leads.id, quotes.leadId)).where(eq(quotes.token, token)).limit(1),
    storeConfig(),
  ]);
  if (!row) return null;
  const { quote } = row;
  const today = bogotaDay();
  const status = quote.status === "sent" && !!quote.validUntil && quote.validUntil < today ? "expired" : quote.status as ProposalView["status"];
  // El responsable del lead firma la propuesta; si no hay, quien creó la cotización (cuando es un nombre y no el correo de la sesión).
  const owner = row.owner?.trim() || (quote.createdBy && !quote.createdBy.includes("@") ? quote.createdBy.trim() : "");
  const asesor = owner || DEFAULT_ASESOR;
  return {
    token, number: quote.number, title: quote.title, status, organization: row.organization, city: row.city,
    asesor, asesorFirst: owner ? owner.split(/\s+/)[0] : null,
    initials: owner ? owner.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0].toUpperCase()).join("") : "AL",
    validShort: quote.validUntil ? `Válida ${formatDay(quote.validUntil)}` : "Vigente",
    validLong: quote.validUntil ? dayLong(quote.validUntil) : "nuevo aviso",
    daysLeft: quote.validUntil ? Math.max(0, Math.round((Date.parse(quote.validUntil) - Date.parse(today)) / 86_400_000)) : 0,
    decidedOn: quote.decidedAt ? longDate.format(quote.decidedAt) : null,
    totalInCents: quote.totalInCents,
    plan: readProposalPlan(parseItems(quote.items), quote.discountInCents, { students: row.students, grades: row.grades }),
    whatsappDigits: config.whatsappDigits,
  };
});

export type ProposalOpened = { leadId: string; number: string; organization: string; owner: string | null; totalInCents: number };

/**
 * Registra una visita a la propuesta en el historial del lead (una actividad por visita que se actualiza mientras
 * la leen) y recalcula el puntaje. Los borradores no cuentan: solo los abre el asesor para revisarlos.
 * `first` indica la primera apertura de esta propuesta, para avisar al asesor.
 */
export async function recordProposalRead(token: string, visit: string, read: ProposalRead): Promise<{ tracked: boolean; first: ProposalOpened | null } | null> {
  if (!TOKEN.test(token) || !/^[a-f0-9]{16,32}$/.test(visit)) return null;
  // Dos avances de la misma visita pueden llegar a la vez (abrir y jugar la Arena): SQLite rechaza la segunda escritura
  // con SQLITE_BUSY mientras la primera termina, así que se reintenta un par de veces.
  for (let attempt = 1; ; attempt++) {
    try { return await writeRead(token, visit, read); }
    catch (error) {
      if ((error as { code?: string } | null)?.code !== "SQLITE_BUSY" || attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 120 * attempt));
    }
  }
}

function writeRead(token: string, visit: string, read: ProposalRead) {
  return getDb().transaction(async (tx) => {
    const [quote] = await tx.select({ id: quotes.id, leadId: quotes.leadId, number: quotes.number, status: quotes.status, totalInCents: quotes.totalInCents, organization: leads.organization, owner: leads.owner })
      .from(quotes).innerJoin(leads, eq(leads.id, quotes.leadId)).where(eq(quotes.token, token)).limit(1);
    if (!quote) return null;
    if (quote.status === "draft") return { tracked: false, first: null };
    // El id de la actividad agrupa las visitas de esta propuesta: `proposal:<cotización>:<visita>`.
    const prefix = `proposal:${quote.id}:`;
    const id = `${prefix}${visit}`;
    const [existing] = await tx.select({ createdAt: leadActivities.createdAt }).from(leadActivities).where(eq(leadActivities.id, id)).limit(1);
    const createdAt = existing?.createdAt ?? new Date();
    const [{ earlier }] = await tx.select({ earlier: count() }).from(leadActivities).where(and(like(leadActivities.id, `${prefix}%`), lt(leadActivities.createdAt, createdAt)));
    const summary = proposalReadSummary(quote.number, earlier + 1, read);
    if (existing) await tx.update(leadActivities).set({ summary }).where(eq(leadActivities.id, id));
    else await tx.insert(leadActivities).values({ id, leadId: quote.leadId, type: PROPOSAL_ACTIVITY, summary, createdBy: "Propuesta web", createdAt });
    await refreshScore(tx, quote.leadId);
    const first = !existing && earlier === 0;
    return { tracked: true, first: first ? { leadId: quote.leadId, number: quote.number, organization: quote.organization, owner: quote.owner, totalInCents: quote.totalInCents } : null };
  });
}

/** Aviso al equipo (el mismo canal que los contactos nuevos) la primera vez que el colegio abre la propuesta. */
export async function notifyProposalOpened(opened: ProposalOpened, origin: string) {
  const config = await storeConfig();
  if (!config.notifyTo) return;
  const mail = renderEmail({
    title: `${opened.organization} abrió la propuesta`,
    intro: `${opened.owner ? `${opened.owner}: ` : ""}${opened.organization} acaba de abrir la propuesta ${opened.number}. Es un buen momento para escribirles: la están leyendo.`,
    rows: [["Propuesta", opened.number], ["Valor", formatMoney(opened.totalInCents)], ["Responsable", opened.owner ?? "Sin asignar"]],
    paragraphs: ["En el historial del lead verás qué secciones vio, cuánto tiempo y si jugó la Arena."],
    cta: { label: "Abrir en el CRM", url: `${origin}/admin/crm?lead=${opened.leadId}` },
    footer: "Aviso automático del CRM Alesya.",
  });
  await sendMail({ to: config.notifyTo, subject: `Propuesta abierta · ${opened.organization}`, ...mail });
}
