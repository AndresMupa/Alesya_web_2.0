"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { CalendarClock, FileText, Mail, MessageCircle, PencilLine, Phone, School, Users } from "lucide-react";
import { Drawer, send, useJson } from "@/components/admin/kit";
import { MessageComposer } from "@/components/admin/crm/message-composer";
import { QuoteDrawer, QuoteStatusPill } from "@/components/admin/crm/quote-drawer";
import { orderStatusLabel } from "@/lib/commerce/constants";
import { MAX_ATTEMPTS, activityTypeLabel, activityTypes, leadPriorities, leadSourceLabel, leadStageLabel, leadStages, lostReasons, programs, type ActivityType } from "@/lib/crm/constants";
import { budgetRanges, calendars, gradeLevels, sectors, techLevels } from "@/lib/crm/score";
import { bogotaDay, formatDateTime, formatDay, formatMoney, whatsappLink } from "@/lib/format";

type Lead = {
  id: string; name: string; organization: string; email: string | null; phone: string | null; city: string | null; website: string | null; message: string; source: string; stage: string; owner: string | null;
  externalId: string | null; priority: string; notes: string; lastContact: string | null; nextFollowUp: string | null; estimatedValueInCents: number; lostReason: string | null; createdAt: string; updatedAt: string;
  nextAction: string | null; expectedClose: string | null; students: number; program: string | null; decisionMaker: string | null; grades: string | null; sector: string | null; calendar: string | null; techLevel: string | null; budgetRange: string | null; painPoints: string; competitors: string | null; score: number;
};
type Activity = { id: string; type: string; summary: string; createdBy: string | null; createdAt: string };
type Quote = { id: string; number: string; status: string; title: string; totalInCents: number; validUntil: string | null; token: string; createdAt: string };
type Detail = { lead: Lead; activities: Activity[]; orders: { id: string; reference: string; status: string; totalInCents: number; createdAt: string }[]; quotes: Quote[]; score: { total: number; grade: "A" | "B" | "C"; fit: number; engagement: number; reasons: string[] }; playbook: { probability: number; nextAction: string; days: number; hint: string } | null };

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
  const { lead, score, playbook } = detail;
  const [losing, setLosing] = useState(false);
  const [activityType, setActivityType] = useState<ActivityType>("call");
  const [summary, setSummary] = useState("");
  const [followUp, setFollowUp] = useState(lead.nextFollowUp ?? "");
  const [composing, setComposing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [quoteId, setQuoteId] = useState<string | "new" | null>(null);
  const attempts = detail.activities.filter((activity) => activity.type === "attempt").length;
  const stamp = asesor ? { asesor } : {};
  const open = !["won", "lost"].includes(lead.stage);

  async function patch(changes: Record<string, unknown>, message: string) {
    setSaving(true);
    const result = await send(`/api/admin/crm/leads/${lead.id}`, "PATCH", { ...changes, ...stamp }, message);
    setSaving(false);
    if (result) reload();
    return !!result;
  }

  function pickType(type: ActivityType) {
    setActivityType(type);
    if (type === "attempt" && !followUp) setFollowUp(bogotaDay(2));
  }

  async function logActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = summary.trim() || (activityType === "attempt" ? "Intento sin respuesta." : "");
    setSaving(true);
    const result = await send(`/api/admin/crm/leads/${lead.id}/activities`, "POST", { type: activityType, summary: text, nextFollowUp: followUp || null, ...stamp }, "Gestión registrada.");
    setSaving(false);
    if (result) { setSummary(""); reload(); }
  }

  /** Guarda solo lo que cambió respecto a la ficha actual. */
  async function saveForm(event: FormEvent<HTMLFormElement>, keys: string[], numeric: string[] = [], message = "Datos actualizados.") {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next: Record<string, unknown> = {};
    for (const key of keys) {
      if (key === "grades") { next.grades = form.getAll("grades").map(String).join(",") || null; continue; }
      const raw = String(form.get(key) ?? "").trim();
      next[key] = numeric.includes(key) ? Math.max(0, Math.round(Number(raw) || 0)) : raw || null;
    }
    if (next.painPoints === null) next.painPoints = "";
    if (next.notes === null) next.notes = "";
    const current: Record<string, unknown> = { ...lead, estimatedValue: Math.round(lead.estimatedValueInCents / 100) };
    const changes = Object.fromEntries(Object.entries(next).filter(([key, value]) => (current[key] ?? null) !== value && !(current[key] === "" && value === null)));
    if (!Object.keys(changes).length) return;
    await patch(changes, message);
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

    <section className="adm-score-card" data-grade={score.grade}>
      <div className="adm-score-main"><b>{score.grade}</b><div><strong>{score.total}<small>/100</small></strong><span>Puntaje de la oportunidad</span></div></div>
      <div className="adm-score-bars">
        <label><span>Ajuste del colegio</span><i style={{ width: `${Math.round((score.fit / 60) * 100)}%` }} /><em>{score.fit}/60</em></label>
        <label><span>Avance de la relación</span><i style={{ width: `${Math.round((score.engagement / 40) * 100)}%` }} /><em>{score.engagement}/40</em></label>
      </div>
      {score.reasons.length > 0 && <div className="adm-chip-row adm-score-reasons">{score.reasons.map((reason) => <span key={reason} className="adm-chip">{reason}</span>)}</div>}
    </section>

    <div className="adm-lead-facts">
      <div><span>Valor estimado</span><strong>{lead.estimatedValueInCents ? formatMoney(lead.estimatedValueInCents) : "—"}</strong>{lead.expectedClose && <small>Cierre esperado {formatDay(lead.expectedClose)}</small>}</div>
      <div><span>Último contacto</span><strong>{formatDay(lead.lastContact)}</strong>{attempts > 0 && <small>{attempts} {attempts === 1 ? "intento" : "intentos"} sin respuesta</small>}</div>
      <div><span>Próximo seguimiento</span><strong className={lead.nextFollowUp && lead.nextFollowUp <= bogotaDay() ? "is-due" : undefined}>{formatDay(lead.nextFollowUp)}</strong>{open && !lead.nextFollowUp && <small className="is-due">Sin programar</small>}</div>
      <div><span>Responsable</span><strong>{lead.owner ?? "Sin asignar"}</strong>{!lead.owner && asesor && <button type="button" className="adm-link-button" onClick={() => void patch({ owner: asesor }, `Asignado a ${asesor}.`)}>Asignarme</button>}</div>
    </div>
    {open && <div className="adm-next-action">
      <span>Siguiente acción</span>
      <strong>{lead.nextAction ?? playbook?.nextAction ?? "Define el siguiente paso"}</strong>
      {playbook?.hint && <small>{playbook.hint}</small>}
    </div>}
    {attempts >= MAX_ATTEMPTS && open && <p className="adm-callout">Ya van {attempts} intentos sin respuesta. Si sigue sin contestar, márcalo como <strong>Perdido · Sin respuesta</strong> para sacarlo de la cola.</p>}

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
      <div className="adm-card-row"><h3><FileText size={15} /> Cotizaciones</h3><button type="button" className="refresh-button" onClick={() => setQuoteId("new")}>+ Nueva cotización</button></div>
      {detail.quotes.length ? <ul className="adm-plain-list">{detail.quotes.map((quote) => <li key={quote.id}>
        <span><button type="button" className="adm-link-button" onClick={() => setQuoteId(quote.id)}>{quote.number} · {quote.title}</button><small>Vigente hasta {formatDay(quote.validUntil)} · creada {formatDay(quote.createdAt.slice(0, 10))}</small></span>
        <QuoteStatusPill status={quote.status} />
        <strong>{formatMoney(quote.totalInCents)}</strong>
      </li>)}</ul> : <p className="adm-muted">Sin cotizaciones. Crea una con productos del catálogo y renglones libres; se envía por enlace y el colegio puede aceptarla en línea.</p>}
    </section>

    <form className="adm-card adm-form" onSubmit={(event) => void saveForm(event, ["students", "sector", "calendar", "grades", "techLevel", "budgetRange", "program", "decisionMaker", "painPoints", "competitors", "expectedClose", "nextAction"], ["students"], "Estudio del colegio guardado. Puntaje recalculado.")}>
      <h3><School size={16} /> Estudio del colegio</h3>
      <p className="adm-muted">Lo que sabemos de la institución. Alimenta el puntaje y la cotización.</p>
      <div className="adm-form-grid">
        <label>Estudiantes<input name="students" type="number" min="0" max="100000" defaultValue={lead.students || ""} placeholder="0" /></label>
        <label>Sector<select name="sector" defaultValue={lead.sector ?? ""}><option value="">Sin dato</option>{sectors.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>Calendario<select name="calendar" defaultValue={lead.calendar ?? ""}><option value="">Sin dato</option>{calendars.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>Presupuesto estimado<select name="budgetRange" defaultValue={lead.budgetRange ?? ""}><option value="">Sin dato</option>{budgetRanges.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className="adm-span-2">Nivel tecnológico actual<select name="techLevel" defaultValue={lead.techLevel ?? ""}><option value="">Sin dato</option>{techLevels.map((item) => <option key={item.value} value={item.value}>{item.label} — {item.hint}</option>)}</select></label>
        <div className="adm-span-2 adm-checks-inline"><span>Niveles</span>{gradeLevels.map((level) => <label key={level.value}><input type="checkbox" name="grades" value={level.value} defaultChecked={(lead.grades ?? "").split(",").includes(level.value)} /> {level.label}</label>)}</div>
        <label>Programa de interés<input name="program" list="adm-programs" defaultValue={lead.program ?? ""} maxLength={120} placeholder="Elige o escribe" /><datalist id="adm-programs">{programs.map((item) => <option key={item} value={item} />)}</datalist></label>
        <label>Quién decide<input name="decisionMaker" defaultValue={lead.decisionMaker ?? ""} maxLength={160} placeholder="Nombre · cargo" /></label>
        <label>Proveedor o programa actual<input name="competitors" defaultValue={lead.competitors ?? ""} maxLength={200} placeholder="Ej. ya trabajan con…" /></label>
        <label>Cierre esperado<input name="expectedClose" type="date" defaultValue={lead.expectedClose ?? ""} /></label>
        <label className="adm-span-2">Siguiente acción<input name="nextAction" defaultValue={lead.nextAction ?? ""} maxLength={200} placeholder={playbook?.nextAction || "Qué sigue con este colegio"} /></label>
      </div>
      <label>Necesidades y dolores<textarea name="painPoints" defaultValue={lead.painPoints} rows={3} maxLength={2000} placeholder="Qué quieren lograr, qué les preocupa, qué han intentado" /></label>
      <button className="button button-dark" type="submit" disabled={saving}>Guardar estudio</button>
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

    <form className="adm-card adm-form" onSubmit={(event) => void saveForm(event, ["organization", "name", "email", "phone", "city", "website", "owner", "priority", "notes", "nextFollowUp", "estimatedValue"], ["estimatedValue"])}>
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

    <QuoteDrawer quoteId={quoteId} lead={{ id: lead.id, organization: lead.organization, name: lead.name, phone: lead.phone, email: lead.email, city: lead.city, program: lead.program }} asesor={asesor} onClose={() => setQuoteId(null)} onChanged={reload} />
  </div>;
}
