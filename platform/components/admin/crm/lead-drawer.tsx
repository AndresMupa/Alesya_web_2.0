"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { CalendarClock, Mail, MessageCircle, PencilLine, Phone, Users } from "lucide-react";
import { Drawer, send, useJson } from "@/components/admin/kit";
import { MessageComposer } from "@/components/admin/crm/message-composer";
import { orderStatusLabel } from "@/lib/commerce/constants";
import { MAX_ATTEMPTS, activityTypeLabel, activityTypes, leadPriorities, leadSourceLabel, leadStageLabel, leadStages, lostReasons, type ActivityType } from "@/lib/crm/constants";
import { bogotaDay, formatDateTime, formatDay, formatMoney, whatsappLink } from "@/lib/format";

type Lead = {
  id: string; name: string; organization: string; email: string | null; phone: string | null; city: string | null; website: string | null; message: string; source: string; stage: string; owner: string | null;
  externalId: string | null; priority: string; notes: string; lastContact: string | null; nextFollowUp: string | null; estimatedValueInCents: number; lostReason: string | null; createdAt: string; updatedAt: string;
};
type Activity = { id: string; type: string; summary: string; createdBy: string | null; createdAt: string };
type Detail = { lead: Lead; activities: Activity[]; orders: { id: string; reference: string; status: string; totalInCents: number; createdAt: string }[] };

const quickDays = [["Mañana", 1], ["3 días", 3], ["1 semana", 7], ["2 semanas", 14]] as const;

export function LeadDrawer({ leadId, asesor = "", onClose, onChanged }: { leadId: string | null; asesor?: string; onClose: () => void; onChanged: () => void }) {
  const [revision, setRevision] = useState(0);
  const { data, error, loading } = useJson<Detail>(leadId ? `/api/admin/crm/leads/${leadId}` : null, revision);
  const detail = data && data.lead.id === leadId ? data : null;
  const reload = () => { setRevision((value) => value + 1); onChanged(); };

  return <Drawer open={!!leadId} onClose={onClose}
    title={detail?.lead.organization ?? (error || "Cargando contacto…")}
    subtitle={detail && <>{detail.lead.name}{detail.lead.city && ` · ${detail.lead.city}`} · {leadSourceLabel(detail.lead.source)}</>}
    actions={detail && <ContactLinks lead={detail.lead} />}>
    {!detail ? <p className="adm-muted">{loading ? "Cargando…" : error}</p> : <LeadDetail key={detail.lead.updatedAt} detail={detail} asesor={asesor} reload={reload} />}
  </Drawer>;
}

function ContactLinks({ lead }: { lead: Lead }) {
  const wa = whatsappLink(lead.phone, `Hola ${lead.name.split(" ")[0]}, te escribimos de Alesya X-Tech.`);
  return <div className="adm-contact-links">
    {wa && <a href={wa} target="_blank" rel="noopener noreferrer" title="WhatsApp"><MessageCircle size={16} /></a>}
    {lead.phone && <a href={`tel:${lead.phone.split(/[;,/]/)[0].trim()}`} title="Llamar"><Phone size={16} /></a>}
    {lead.email && <a href={`mailto:${lead.email}`} title="Correo"><Mail size={16} /></a>}
  </div>;
}

function LeadDetail({ detail, asesor, reload }: { detail: Detail; asesor: string; reload: () => void }) {
  const { lead } = detail;
  const [losing, setLosing] = useState(false);
  const [activityType, setActivityType] = useState<ActivityType>("call");
  const [summary, setSummary] = useState("");
  const [followUp, setFollowUp] = useState(lead.nextFollowUp ?? "");
  const [composing, setComposing] = useState(false);
  const [saving, setSaving] = useState(false);
  const attempts = detail.activities.filter((activity) => activity.type === "attempt").length;
  const stamp = asesor ? { asesor } : {};

  async function patch(changes: Record<string, unknown>, message: string) {
    setSaving(true);
    const result = await send(`/api/admin/crm/leads/${lead.id}`, "PATCH", { ...changes, ...stamp }, message);
    setSaving(false);
    if (result) reload();
    return !!result;
  }

  function pickType(type: ActivityType) {
    setActivityType(type);
    // Un intento sin respuesta programa el reintento en 2 días si no hay fecha.
    if (type === "attempt" && !followUp) setFollowUp(bogotaDay(2));
  }

  async function logActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    // Un intento sin respuesta no necesita descripción.
    const text = summary.trim() || (activityType === "attempt" ? "Intento sin respuesta." : "");
    const result = await send(`/api/admin/crm/leads/${lead.id}/activities`, "POST", { type: activityType, summary: text, nextFollowUp: followUp || null, ...stamp }, "Gestión registrada.");
    setSaving(false);
    if (result) { setSummary(""); reload(); }
  }

  async function saveData(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();
    const next: Record<string, unknown> = {
      name: text("name"), organization: text("organization"), email: text("email") || null, phone: text("phone") || null, city: text("city") || null, website: text("website") || null,
      owner: text("owner") || null, priority: text("priority"), notes: text("notes"), nextFollowUp: text("nextFollowUp") || null, estimatedValue: Math.max(0, Math.round(Number(text("estimatedValue")) || 0)),
    };
    const current: Record<string, unknown> = { ...lead, estimatedValue: Math.round(lead.estimatedValueInCents / 100) };
    const changes = Object.fromEntries(Object.entries(next).filter(([key, value]) => (current[key] ?? null) !== value && !(current[key] === "" && value === null)));
    if (!Object.keys(changes).length) return;
    await patch(changes, "Datos actualizados.");
  }

  return <div className="adm-lead">
    <section className="adm-stage-bar" aria-label="Etapa">
      {leadStages.map((stage) => <button key={stage.value} type="button" disabled={saving} className={lead.stage === stage.value ? "is-active" : undefined} data-stage={stage.value}
        onClick={() => { if (stage.value === lead.stage) return; if (stage.value === "lost") setLosing(true); else void patch({ stage: stage.value }, `Etapa: ${stage.label}.`); }}>{stage.label}</button>)}
    </section>
    {losing && <div className="adm-inline-panel">
      <p><strong>¿Por qué se perdió?</strong> El motivo alimenta el análisis de ventas.</p>
      <div className="adm-chip-row">{lostReasons.map((reason) => <button key={reason} type="button" className="adm-chip" onClick={() => { setLosing(false); void patch({ stage: "lost", lostReason: reason }, "Marcado como perdido."); }}>{reason}</button>)}</div>
      <button type="button" className="adm-link-button" onClick={() => setLosing(false)}>Cancelar</button>
    </div>}
    {lead.stage === "lost" && lead.lostReason && <p className="adm-muted">Motivo de pérdida: <strong>{lead.lostReason}</strong></p>}

    <div className="adm-lead-facts">
      <div><span>Valor estimado</span><strong>{lead.estimatedValueInCents ? formatMoney(lead.estimatedValueInCents) : "—"}</strong></div>
      <div><span>Último contacto</span><strong>{formatDay(lead.lastContact)}</strong>{attempts > 0 && <small>{attempts} {attempts === 1 ? "intento" : "intentos"} sin respuesta</small>}</div>
      <div><span>Próximo seguimiento</span><strong className={lead.nextFollowUp && lead.nextFollowUp <= bogotaDay() ? "is-due" : undefined}>{formatDay(lead.nextFollowUp)}</strong></div>
      <div><span>Responsable</span><strong>{lead.owner ?? "Sin asignar"}</strong>{!lead.owner && asesor && <button type="button" className="adm-link-button" onClick={() => void patch({ owner: asesor }, `Asignado a ${asesor}.`)}>Asignarme</button>}</div>
    </div>
    {attempts >= MAX_ATTEMPTS && !["won", "lost"].includes(lead.stage) && <p className="adm-callout">Ya van {attempts} intentos sin respuesta. Si sigue sin contestar, márcalo como <strong>Perdido · Sin respuesta</strong> para sacarlo de la cola.</p>}

    <section className="adm-card">
      <div className="adm-card-row"><h3><PencilLine size={15} /> Escribir con plantilla</h3><button type="button" className="adm-link-button" onClick={() => setComposing(!composing)}>{composing ? "Ocultar" : "Mostrar"}</button></div>
      {composing && <MessageComposer lead={lead} asesor={asesor} compact onOpened={(channel, template) => { setActivityType(channel === "email" ? "email" : "whatsapp"); setSummary((current) => current || `Plantilla “${template}” enviada.`); }} />}
    </section>

    <form className="adm-card adm-log" onSubmit={logActivity}>
      <h3>Registrar gestión</h3>
      <div className="adm-chip-row" role="radiogroup" aria-label="Tipo de gestión">
        {activityTypes.map((type) => <button key={type.value} type="button" role="radio" aria-checked={activityType === type.value} className={`adm-chip${activityType === type.value ? " is-active" : ""}`} onClick={() => pickType(type.value)}>{type.label}</button>)}
      </div>
      <textarea value={summary} onChange={(event) => setSummary(event.target.value)} required={activityType !== "attempt"} minLength={3} maxLength={2000} rows={3} placeholder={activityType === "attempt" ? "Por qué canal intentaste y a qué hora (opcional)" : "¿Qué pasó? Resultado de la conversación, acuerdos y siguiente paso."} />
      <div className="adm-followup">
        <label><CalendarClock size={14} /> {activityType === "attempt" ? "Reintentar el" : "Próximo seguimiento"}<input type="date" value={followUp} onChange={(event) => setFollowUp(event.target.value)} /></label>
        <div className="adm-chip-row">{quickDays.map(([label, days]) => <button key={label} type="button" className="adm-chip" onClick={() => setFollowUp(bogotaDay(days))}>{label}</button>)}{followUp && <button type="button" className="adm-chip" onClick={() => setFollowUp("")}>Sin fecha</button>}</div>
      </div>
      {lead.stage === "new" && !["note", "attempt"].includes(activityType) && <p className="adm-hint">Al registrar esta gestión el contacto pasa a “Contactado”.</p>}
      <button className="button button-dark" type="submit" disabled={saving}>Guardar gestión</button>
    </form>

    <section className="adm-card">
      <h3>Necesidad</h3>
      <p className="adm-message">{lead.message}</p>
    </section>

    <section className="adm-card">
      <h3>Historial</h3>
      {detail.activities.length ? <ol className="adm-timeline">{detail.activities.map((activity) => <li key={activity.id} data-type={activity.type}>
        <div><strong>{activityTypeLabel(activity.type)}</strong><time>{formatDateTime(activity.createdAt)}</time></div>
        <p>{activity.summary}</p>
        {activity.createdBy && <small>{activity.createdBy}</small>}
      </li>)}</ol> : <p className="adm-muted">Sin gestiones registradas. Registrado el {formatDateTime(lead.createdAt)}.</p>}
    </section>

    {detail.orders.length > 0 && <section className="adm-card">
      <h3>Pedidos en la tienda</h3>
      <ul className="adm-plain-list">{detail.orders.map((order) => <li key={order.id}><Link href={`/admin/pedidos?pedido=${order.id}`}>{order.reference}</Link><span>{orderStatusLabel(order.status)}</span><strong>{formatMoney(order.totalInCents)}</strong></li>)}</ul>
    </section>}

    <form className="adm-card adm-form" onSubmit={saveData}>
      <h3><Users size={16} /> Datos del contacto</h3>
      <div className="adm-form-grid">
        <label>Institución<input name="organization" defaultValue={lead.organization} required minLength={2} maxLength={160} /></label>
        <label>Contacto<input name="name" defaultValue={lead.name} required minLength={2} maxLength={120} /></label>
        <label>Correo<input name="email" type="email" defaultValue={lead.email ?? ""} maxLength={180} /></label>
        <label>Teléfono<input name="phone" defaultValue={lead.phone ?? ""} maxLength={60} placeholder="Varios separados por ;" /></label>
        <label>Ciudad<input name="city" defaultValue={lead.city ?? ""} maxLength={100} /></label>
        <label>Sitio web<input name="website" defaultValue={lead.website ?? ""} maxLength={300} /></label>
        <label>Responsable<input name="owner" defaultValue={lead.owner ?? ""} maxLength={120} placeholder="Asignar asesor" /></label>
        <label>Prioridad<select name="priority" defaultValue={lead.priority}>{leadPriorities.map((priority) => <option key={priority.value} value={priority.value}>{priority.label}</option>)}</select></label>
        <label>Valor estimado (COP)<input name="estimatedValue" type="number" min="0" step="10000" defaultValue={Math.round(lead.estimatedValueInCents / 100) || ""} placeholder="0" /></label>
        <label>Próximo seguimiento<input name="nextFollowUp" type="date" defaultValue={lead.nextFollowUp ?? ""} /></label>
      </div>
      <label>Notas internas<textarea name="notes" defaultValue={lead.notes} rows={3} maxLength={4000} placeholder="Contexto para el equipo" /></label>
      {lead.externalId && <p className="adm-muted">Código DANE / externo: {lead.externalId}</p>}
      <button className="button button-dark" type="submit" disabled={saving}>Guardar datos</button>
    </form>
    <p className="adm-muted adm-small">Etapa actual: {leadStageLabel(lead.stage)} · creado {formatDateTime(lead.createdAt)}</p>
  </div>;
}
