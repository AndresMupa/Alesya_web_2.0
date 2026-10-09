import { and, count, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { leadActivities, leads, quotes } from "@/db/schema";
import { leadStageLabel, workActivityTypes } from "@/lib/crm/constants";
import { getAgenda, getWithoutNextAction } from "@/lib/crm/leads";
import { cronAuthorized } from "@/lib/cron";
import { bogotaDay, formatMoney } from "@/lib/format";
import { noStore } from "@/lib/http";
import { mailStatus, renderEmail, sendMail } from "@/lib/mail";
import { getSettings, storeConfig } from "@/lib/settings";

/**
 * Resumen diario para el equipo (llamar cada mañana desde un cron de cPanel con `?token=CRON_SECRET`):
 * seguimientos vencidos y de hoy por asesor, entrantes sin atender, oportunidades sin siguiente acción,
 * cotizaciones por vencer y gestiones de ayer frente a la meta.
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return Response.json({ message: "No autorizado" }, { status: 401, headers: noStore });
  const db = getDb();
  const today = bogotaDay();
  const yesterdayStart = new Date(Date.parse(`${bogotaDay(-1)}T05:00:00Z`)), todayStart = new Date(Date.parse(`${today}T05:00:00Z`));
  const [agenda, noAction, [inbound], [yesterday], expiring, settings, config] = await Promise.all([
    getAgenda(200), getWithoutNextAction({}, 50),
    db.select({ total: count() }).from(leads).where(and(eq(leads.stage, "new"), sql`${leads.source} not like 'base_colegios_2026%'`)),
    db.select({ total: count() }).from(leadActivities).where(and(inArray(leadActivities.type, workActivityTypes), gte(leadActivities.createdAt, yesterdayStart), lt(leadActivities.createdAt, todayStart))),
    db.select({ number: quotes.number, title: quotes.title, totalInCents: quotes.totalInCents, validUntil: quotes.validUntil, organization: leads.organization }).from(quotes).innerJoin(leads, eq(leads.id, quotes.leadId)).where(and(eq(quotes.status, "sent"), lte(quotes.validUntil, bogotaDay(3)))).limit(20),
    getSettings(), storeConfig(),
  ]);
  const due = agenda.filter((item) => item.nextFollowUp! <= today);
  const byOwner = new Map<string, typeof due>();
  for (const item of due) byOwner.set(item.owner ?? "Sin asignar", [...(byOwner.get(item.owner ?? "Sin asignar") ?? []), item]);
  const goal = Math.max(1, Number(settings["crm.daily_goal"]) || 20);
  const origin = process.env.PRODUCTION_URL?.replace(/\/$/, "") || new URL(request.url).origin;

  const paragraphs: string[] = [];
  for (const [owner, items] of byOwner) paragraphs.push(`${owner} · ${items.length} seguimientos:\n${items.slice(0, 12).map((item) => `• ${item.organization} — ${leadStageLabel(item.stage)}${item.nextAction ? ` · ${item.nextAction}` : ""}${item.nextFollowUp! < today ? " (vencido)" : ""}`).join("\n")}${items.length > 12 ? `\n… y ${items.length - 12} más` : ""}`);
  if (noAction.length) paragraphs.push(`Sin siguiente acción (${noAction.length}): ${noAction.slice(0, 8).map((item) => item.organization).join(", ")}${noAction.length > 8 ? "…" : ""}.`);
  if (expiring.length) paragraphs.push(`Cotizaciones por vencer: ${expiring.map((quote) => `${quote.number} ${quote.organization} (${formatMoney(quote.totalInCents)}, vence ${quote.validUntil})`).join("; ")}.`);
  const summary = { dueFollowUps: due.length, inboundNew: inbound.total, withoutNextAction: noAction.length, expiringQuotes: expiring.length, touchesYesterday: yesterday.total, goal };

  if (!mailStatus().configured && !mailStatus().devPreview) return Response.json({ sent: false, reason: "Correo no configurado", ...summary }, { headers: noStore });
  const mail = renderEmail({
    title: `Ventas hoy · ${due.length} seguimientos · ${inbound.total} entrantes`,
    intro: `Ayer se registraron ${yesterday.total} gestiones (meta ${goal}). Esto es lo que toca hoy:`,
    rows: [["Seguimientos vencidos u hoy", String(due.length)], ["Entrantes sin atender", String(inbound.total)], ["Sin siguiente acción", String(noAction.length)], ["Cotizaciones por vencer", String(expiring.length)]],
    paragraphs, cta: { label: "Abrir la máquina de ventas", url: `${origin}/admin/ventas` }, footer: "Resumen automático del CRM Alesya.",
  });
  const result = await sendMail({ to: config.notifyTo, subject: mail.text.split("\n")[0], ...mail });
  return Response.json({ sent: result.sent, reason: result.reason, to: config.notifyTo, ...summary }, { headers: noStore });
}
