import "server-only";
import { and, count, desc, eq, gte, inArray, max, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { inboundEmails, leadActivities, leads, settings } from "@/db/schema";
import { leadStageLabel, openLeadStages, type LeadStage } from "@/lib/crm/constants";
import { leadValues } from "@/lib/crm/leads";
import { bogotaDay } from "@/lib/format";
import { inboxStatus, readInbox, type InboundMessage, type InboxAddress } from "@/lib/inbox";
import { getSettings } from "@/lib/settings";
import { site } from "@/lib/site";

/**
 * Captación por correo: revisa el buzón comercial y lleva cada correo al CRM.
 * - Si quien escribe ya es un contacto (mismo correo, o el único de su dominio institucional), la gestión queda en
 *   su historial y, si la oportunidad está abierta, pasa a prioridad alta con seguimiento para hoy. Una perdida que
 *   vuelve a escribir se reabre como "Contactado".
 * - Si no, entra como lead nuevo (origen "Correo", prioridad alta), igual que un formulario web.
 * - Se omiten los correos del propio equipo, respuestas automáticas, boletines, spam y los remitentes ignorados
 *   en Configuración. Cada correo se revisa una sola vez y queda registrado en `inbound_emails`.
 */

const MAX_PER_RUN = 40;
const FIRST_SYNC_DAYS = 3;
const STATUS_KEY = "inbox.last_sync";

/** Proveedores de correo personal: su dominio no identifica a una institución. */
const FREE_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "hotmail.es", "hotmail.co", "outlook.com", "outlook.es", "live.com", "live.com.mx", "msn.com",
  "yahoo.com", "yahoo.es", "yahoo.com.co", "yahoo.com.mx", "ymail.com", "icloud.com", "me.com", "mac.com", "aol.com", "protonmail.com", "proton.me",
  "gmx.com", "zoho.com", "mail.com", "une.net.co", "etb.net.co", "emcali.net.co",
]);
const AUTOMATED_SENDER = /^(no-?reply|do-?not-?reply|noresponder|no-?responder|mailer-daemon|postmaster|bounces?|notifications?|notificaciones|newsletter|boletin)([+._@-]|$)/i;
const AUTO_REPLY_SUBJECT = /^\s*(respuesta autom[aá]tica|automatic reply|auto[- ]?reply|autoreply|fuera de (la )?oficina|out of (the )?office|undeliverable|no se puede entregar|delivery status notification|mail delivery (failed|subsystem)|returned mail)\b/i;
const INSTITUTION_NAME = /\b(colegio|instituci[oó]n|instituto|escuela|liceo|gimnasio|fundaci[oó]n|universidad|corporaci[oó]n|secretar[ií]a|centro educativo|jard[ií]n)\b/i;

export type InboxSyncResult = { at: string; ok: boolean; error?: string; created: number; matched: number; skipped: number; more: boolean };

type Decision =
  | { result: "skipped"; reason: string; contact: InboxAddress | null }
  | { result: "matched"; contact: InboxAddress; leadId: string; viaDomain: boolean }
  | { result: "created"; contact: InboxAddress };

type Context = { ownAddresses: Set<string>; ownDomains: Set<string>; ignore: string[] };

const domainOf = (address: string) => address.slice(address.lastIndexOf("@") + 1).toLowerCase();
const isOwn = (address: string, context: Context) => context.ownAddresses.has(address) || [...context.ownDomains].some((domain) => domainOf(address) === domain || domainOf(address).endsWith(`.${domain}`));
const isIgnored = (address: string, ignore: string[]) => ignore.some((token) => token.includes("@") ? address === token : domainOf(address) === token || domainOf(address).endsWith(`.${token}`));

/** Correos y dominios del propio equipo (el buzón, el remitente SMTP y el correo público); los dominios gratuitos cuentan solo como dirección. */
function buildContext(values: Record<string, string>, mailboxUser: string): Context {
  const ownAddresses = new Set<string>(), ownDomains = new Set<string>();
  for (const raw of [mailboxUser, site.email, process.env.SMTP_USER, process.env.MAIL_FROM?.match(/[^\s<>"]+@[^\s<>"]+/)?.[0]]) {
    const address = raw?.trim().toLowerCase();
    if (!address?.includes("@")) continue;
    ownAddresses.add(address);
    if (!FREE_DOMAINS.has(domainOf(address))) ownDomains.add(domainOf(address));
  }
  const ignore = (values["crm.inbox_ignore"] ?? "").split(/[\s,;]+/).map((token) => token.trim().toLowerCase().replace(/^@/, "")).filter((token) => token.length > 2);
  return { ownAddresses, ownDomains, ignore };
}

/** Quién escribe: los formularios y avisos de terceros llegan desde un no-reply con la persona en Reply-To. */
function contactOf(message: InboundMessage, context: Context) {
  const { from, replyTo } = message;
  if (replyTo && replyTo.address !== from?.address && !isOwn(replyTo.address, context) && !AUTOMATED_SENDER.test(replyTo.address)) return replyTo;
  return from;
}

async function decide(message: InboundMessage, context: Context): Promise<Decision> {
  const contact = contactOf(message, context);
  const skip = (reason: string): Decision => ({ result: "skipped", reason, contact });
  if (!contact) return skip("Sin remitente");
  if (isOwn(contact.address, context)) return skip("Correo del equipo");
  const headers = message.headers;
  if (/^yes/i.test(headers["x-spam-flag"] ?? "")) return skip("Marcado como spam");
  if ((headers["auto-submitted"] && !/^no\b/i.test(headers["auto-submitted"])) || headers["x-autoreply"] || headers["x-autorespond"] || /^(auto_reply|auto-reply)/i.test(headers.precedence ?? "") || AUTO_REPLY_SUBJECT.test(message.subject)) return skip("Respuesta automática");
  if (headers["list-id"] || headers["list-unsubscribe"] || /^(bulk|list|junk)/i.test(headers.precedence ?? "")) return skip("Boletín o lista de correo");
  if (AUTOMATED_SENDER.test(contact.address)) return skip("Envío automático (no-reply)");
  if (isIgnored(contact.address, context.ignore)) return skip("Remitente ignorado en Configuración");

  const db = getDb();
  const [byEmail] = await db.select({ id: leads.id }).from(leads).where(eq(leads.email, contact.address)).orderBy(desc(leads.updatedAt)).limit(1);
  if (byEmail) return { result: "matched", contact, leadId: byEmail.id, viaDomain: false };
  const domain = domainOf(contact.address);
  if (!FREE_DOMAINS.has(domain)) {
    const sameDomain = await db.select({ id: leads.id }).from(leads).where(sql`${leads.email} like ${`%@${domain}`}`).limit(2);
    if (sameDomain.length === 1) return { result: "matched", contact, leadId: sameDomain[0].id, viaDomain: true };
  }
  return { result: "created", contact };
}

/** Texto útil del correo: sin la conversación citada ni la firma. El teléfono se busca antes de cortar la firma. */
export function emailBody(text: string) {
  let body = text.replace(/\r\n?/g, "\n");
  const quoted = body.search(/\n[^\n]{0,4}(El|On)\s[^\n]{0,200}(\n[^\n]{0,200})?\s(escribi[oó]|wrote)\s?:|\n-{2,}\s*(Original Message|Mensaje original|Forwarded message|Mensaje reenviado)|\n_{8,}\s*\n|\n(De|From):\s[^\n]+\n(Enviado|Sent|Fecha|Date):/i);
  if (quoted > 0) body = body.slice(0, quoted);
  body = body.split("\n").filter((line) => !line.startsWith(">")).join("\n");
  const phone = body.match(/(?<!\d)(?:\+?57[\s.-]?)?\(?3\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/)?.[0].replace(/\D/g, "").slice(-10) ?? null;
  const signature = body.search(/\n-- ?\n|\nEnviado desde mi |\nSent from my /);
  if (signature > 0) body = body.slice(0, signature);
  return { body: body.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim(), phone };
}

/** Nombre e institución a partir del remitente; el asesor los corrige en la ficha. */
function identityOf(contact: InboxAddress) {
  const local = contact.address.slice(0, contact.address.lastIndexOf("@"));
  const fromLocal = local.replace(/\d+/g, " ").replace(/[._+-]+/g, " ").trim().replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
  const name = (contact.name && !contact.name.includes("@") ? contact.name : fromLocal.length >= 2 ? fromLocal : contact.address).slice(0, 120);
  const domain = domainOf(contact.address);
  const organization = INSTITUTION_NAME.test(contact.name) ? contact.name : FREE_DOMAINS.has(domain) ? name : domain;
  return { name, organization: organization.slice(0, 160) };
}

const quote = (subject: string) => `«${subject || "(sin asunto)"}»`;
const excerpt = (body: string, length: number) => { const flat = body.replace(/\s+/g, " ").trim(); return flat.length > length ? `${flat.slice(0, length - 1)}…` : flat; };

async function persist(message: InboundMessage, decision: Decision, meta: { mailbox: string; uidValidity: string; mailboxUser: string }) {
  const db = getDb();
  const now = new Date();
  const { body, phone } = emailBody(message.text);
  const row = {
    id: crypto.randomUUID(), messageId: message.messageId.slice(0, 500), mailbox: meta.mailbox, uidValidity: meta.uidValidity, uid: message.uid,
    fromEmail: decision.contact?.address ?? message.from?.address ?? null, fromName: (decision.contact?.name || message.from?.name || null)?.slice(0, 160) ?? null,
    subject: message.subject.slice(0, 300), receivedAt: message.date, result: decision.result, reason: decision.result === "skipped" ? decision.reason : null, leadId: null as string | null, createdAt: now,
  };

  if (decision.result === "skipped") { await db.insert(inboundEmails).values(row); return; }

  if (decision.result === "created") {
    const { name, organization } = identityOf(decision.contact);
    const lead = leadValues({ name, organization, email: decision.contact.address, phone, message: `Asunto: ${message.subject || "(sin asunto)"}\n\n${body || "(sin texto)"}`.slice(0, 2000), source: "email", priority: "high" }, now);
    await db.transaction(async (tx) => {
      await tx.insert(leads).values(lead);
      await tx.insert(inboundEmails).values({ ...row, leadId: lead.id });
      await tx.insert(leadActivities).values({ id: crypto.randomUUID(), leadId: lead.id, type: "email_in", summary: `Llegó por correo a ${meta.mailboxUser}: ${quote(message.subject)}.`, createdBy: null, createdAt: now });
    });
    return;
  }

  const { leadId, viaDomain, contact } = decision;
  const who = contact.name ? `${contact.name} <${contact.address}>` : contact.address;
  const summary = `${viaDomain ? `Escribió otra persona de la institución: ${who}` : `De ${who}`} · ${quote(message.subject)}${body ? ` — ${excerpt(body, 280)}` : ""}`;
  const today = bogotaDay();
  await db.transaction(async (tx) => {
    const [lead] = await tx.select({ stage: leads.stage, nextFollowUp: leads.nextFollowUp }).from(leads).where(eq(leads.id, leadId)).limit(1);
    await tx.insert(inboundEmails).values({ ...row, leadId });
    await tx.insert(leadActivities).values({ id: crypto.randomUUID(), leadId, type: "email_in", summary, createdBy: null, createdAt: now });
    const changes: Partial<typeof leads.$inferInsert> = { updatedAt: now };
    // Quien escribe pide respuesta hoy: prioridad alta y a la agenda del día. Una oportunidad perdida que vuelve a
    // escribir se reabre (la conversación volvió); un cliente ganado solo suma la gestión a su historial.
    const reopen = lead?.stage === "lost";
    if (lead && (reopen || openLeadStages.includes(lead.stage as LeadStage))) {
      changes.priority = "high";
      if (reopen || !lead.nextFollowUp || lead.nextFollowUp > today) { changes.nextFollowUp = today; changes.nextAction = "Responder el correo recibido"; }
    }
    if (reopen) {
      Object.assign(changes, { stage: "contacted", stageChangedAt: now, lostReason: null });
      await tx.insert(leadActivities).values({ id: crypto.randomUUID(), leadId, type: "stage_change", summary: `${leadStageLabel("lost")} → ${leadStageLabel("contacted")} (automático: volvió a escribir por correo)`, createdBy: null, createdAt: new Date(now.getTime() + 1) });
    }
    await tx.update(leads).set(changes).where(eq(leads.id, leadId));
  });
}

/** Dónde quedó la última revisión del buzón: UIDVALIDITY y UID más alto ya registrados. */
async function readCursor(mailbox: string) {
  const db = getDb();
  const [last] = await db.select({ uidValidity: inboundEmails.uidValidity, createdAt: inboundEmails.createdAt }).from(inboundEmails).where(eq(inboundEmails.mailbox, mailbox)).orderBy(desc(inboundEmails.createdAt)).limit(1);
  if (!last) return null;
  const [{ uid }] = await db.select({ uid: max(inboundEmails.uid) }).from(inboundEmails).where(and(eq(inboundEmails.mailbox, mailbox), eq(inboundEmails.uidValidity, last.uidValidity)));
  return { uidValidity: last.uidValidity, uid: uid ?? 0, at: last.createdAt };
}

export async function lastInboxSync(): Promise<InboxSyncResult | null> {
  const [row] = await getDb().select({ value: settings.value }).from(settings).where(eq(settings.key, STATUS_KEY)).limit(1);
  try { return row ? JSON.parse(row.value) as InboxSyncResult : null; } catch { return null; }
}

async function saveStatus(result: InboxSyncResult) {
  const now = new Date();
  await getDb().insert(settings).values({ key: STATUS_KEY, value: JSON.stringify(result), updatedAt: now }).onConflictDoUpdate({ target: settings.key, set: { value: JSON.stringify(result), updatedAt: now } });
}

function friendlyError(error: unknown) {
  const detail = error as { authenticationFailed?: boolean; code?: string; message?: string };
  if (detail.authenticationFailed) return "El servidor rechazó el usuario o la contraseña del buzón (IMAP_USER / IMAP_PASS).";
  if (detail.code === "ENOTFOUND") return "No se encontró el servidor de correo (IMAP_HOST).";
  if (detail.code === "ECONNREFUSED" || detail.code === "ETIMEDOUT" || /timeout/i.test(detail.message ?? "")) return "El servidor de correo no respondió. Revisa IMAP_HOST e IMAP_PORT (993).";
  if (/mailbox|carpeta|nonexistent/i.test(detail.message ?? "")) return `No se pudo abrir la carpeta del buzón (IMAP_MAILBOX). ${detail.message ?? ""}`.trim();
  return detail.message ? `Error del buzón: ${detail.message}` : "No se pudo revisar el buzón.";
}

async function runSync(): Promise<InboxSyncResult> {
  const config = inboxStatus();
  const tally = { created: 0, matched: 0, skipped: 0 };
  let result: InboxSyncResult;
  try {
    const cursor = await readCursor(config.mailbox);
    const since = new Date(cursor ? cursor.at.getTime() - 86_400_000 : Date.now() - FIRST_SYNC_DAYS * 86_400_000);
    const inbox = await readInbox({ cursor, since, limit: MAX_PER_RUN });
    const context = buildContext(await getSettings(), config.user!);
    const ids = inbox.messages.map((message) => message.messageId.slice(0, 500));
    const known = new Set(ids.length ? (await getDb().select({ id: inboundEmails.messageId }).from(inboundEmails).where(inArray(inboundEmails.messageId, ids))).map((row) => row.id) : []);
    for (const message of inbox.messages) {
      if (known.has(message.messageId.slice(0, 500))) continue;
      known.add(message.messageId.slice(0, 500));
      const decision = await decide(message, context);
      const meta = { mailbox: inbox.mailbox, uidValidity: inbox.uidValidity, mailboxUser: config.user! };
      try {
        await persist(message, decision, meta);
        tally[decision.result] += 1;
      } catch (error) {
        // Otra revisión simultánea ya lo registró (Message-ID único): no es un error.
        const detail = error as { message?: string; cause?: { message?: string } };
        if (/unique/i.test(`${detail.message} ${detail.cause?.message}`)) continue;
        // Un correo que no se puede registrar queda omitido con el motivo para no frenar los siguientes.
        console.error("inbox_persist_failed", message.uid, error);
        await persist(message, { result: "skipped", reason: "No se pudo registrar en el CRM", contact: decision.contact }, meta);
        tally.skipped += 1;
      }
    }
    result = { at: new Date().toISOString(), ok: true, ...tally, more: inbox.more };
  } catch (error) {
    console.error("inbox_sync_failed", error);
    result = { at: new Date().toISOString(), ok: false, error: friendlyError(error), ...tally, more: false };
  }
  await saveStatus(result).catch((error) => console.error("inbox_status_failed", error));
  return result;
}

const shared = globalThis as typeof globalThis & { __alesyaInboxSync?: Promise<InboxSyncResult> };

/**
 * Revisa el buzón y devuelve lo que hizo, o `null` si no está configurado. Con `ifOlderThanMinutes` no hace nada si
 * la última revisión es más reciente (el panel la pide al abrir la máquina de ventas). Dos llamadas a la vez comparten
 * la misma revisión.
 */
export async function syncInbox(options: { ifOlderThanMinutes?: number } = {}): Promise<(InboxSyncResult & { fresh?: boolean }) | null> {
  if (!inboxStatus().configured) return null;
  if (options.ifOlderThanMinutes && !shared.__alesyaInboxSync) {
    const last = await lastInboxSync();
    if (last && Date.now() - Date.parse(last.at) < options.ifOlderThanMinutes * 60_000) return { ...last, created: 0, matched: 0, skipped: 0, fresh: true };
  }
  shared.__alesyaInboxSync ??= runSync().finally(() => { shared.__alesyaInboxSync = undefined; });
  return shared.__alesyaInboxSync;
}

/** Para el panel: estado del buzón, última revisión, totales de 30 días y los últimos correos revisados. */
export async function getInboxOverview() {
  const db = getDb();
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [lastSync, recent, totals] = await Promise.all([
    lastInboxSync(),
    db.select({ id: inboundEmails.id, fromEmail: inboundEmails.fromEmail, fromName: inboundEmails.fromName, subject: inboundEmails.subject, receivedAt: inboundEmails.receivedAt, result: inboundEmails.result, reason: inboundEmails.reason, leadId: inboundEmails.leadId, organization: leads.organization })
      .from(inboundEmails).leftJoin(leads, eq(leads.id, inboundEmails.leadId)).orderBy(desc(inboundEmails.createdAt), desc(inboundEmails.uid)).limit(30),
    db.select({ result: inboundEmails.result, total: count() }).from(inboundEmails).where(gte(inboundEmails.createdAt, since)).groupBy(inboundEmails.result),
  ]);
  const total = (result: string) => totals.find((row) => row.result === result)?.total ?? 0;
  return { inbox: inboxStatus(), lastSync, recent, last30Days: { created: total("created"), matched: total("matched"), skipped: total("skipped") } };
}
