"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ExternalLink, Mail, MessageCircle, Phone, SkipForward, X } from "lucide-react";
import { toast } from "sonner";
import { send, useJson } from "@/components/admin/kit";
import { MessageComposer, mobilesOf, phonesOf } from "@/components/admin/crm/message-composer";
import { MAX_ATTEMPTS, contactChannels, leadPriorityLabel, lostReasons, outcomes, type ContactChannel, type Outcome } from "@/lib/crm/constants";
import { bogotaDay, formatDay, whatsappLink } from "@/lib/format";

type Prospect = { id: string; name: string; organization: string; city: string | null; phone: string | null; email: string | null; website: string | null; externalId: string | null; notes: string; stage: string; priority: string; owner: string | null; attempts: number; nextFollowUp: string | null };
type Batch = { rows: Prospect[]; total: number; cities: string[]; owners: string[] };

const BATCH = 25;
const quickDays = [["Mañana", 1], ["2 días", 2], ["3 días", 3], ["1 semana", 7]] as const;

/**
 * Modo prospección: recorre la cola colegio por colegio. Para cada uno: datos de contacto, plantilla de
 * WhatsApp o correo lista para enviar, y un resultado de un clic que registra la gestión, la etapa y el
 * siguiente seguimiento. Al guardar pasa al siguiente.
 */
export function ProspectingMode({ open, asesor, owner, onClose, onOpenLead }: { open: boolean; asesor: string; owner?: string; onClose: () => void; onOpenLead: (id: string) => void }) {
  const [city, setCity] = useState("");
  const [revision, setRevision] = useState(0);
  const [index, setIndex] = useState(0);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(0);
  const params = new URLSearchParams({ limit: String(BATCH), ...(owner && { owner }), ...(city && { city }) });
  const { data, error, loading } = useJson<Batch>(open ? `/api/admin/crm/prospects?${params}` : null, revision);
  const rows = (data?.rows ?? []).filter((row) => !skipped.has(row.id));
  const current = rows[Math.min(index, Math.max(0, rows.length - 1))];
  const reload = useCallback(() => { setIndex(0); setRevision((value) => value + 1); }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !(event.target instanceof HTMLTextAreaElement)) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  // Al gestionar o saltar, el colegio sale de la lista y el siguiente ocupa su lugar; al acabar el lote se pide otro.
  function dismiss(id: string, finished: boolean) {
    if (finished) setDone((value) => value + 1);
    const remaining = rows.filter((row) => row.id !== id);
    if (!remaining.length) { setSkipped(new Set()); reload(); return; }
    setSkipped((previous) => new Set(previous).add(id));
    setIndex((value) => Math.min(value, remaining.length - 1));
  }

  return <div className="adm-modal-layer adm-prospect-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="adm-prospect" role="dialog" aria-modal="true" aria-label="Modo prospección">
      <header className="adm-prospect-head">
        <div>
          <h2>Modo prospección</h2>
          <p>{data ? <>{Math.max(0, data.total - done).toLocaleString("es-CO")} colegios en cola{owner ? ` · ${owner === "none" ? "sin asignar" : owner}` : ""} · <strong>{done}</strong> gestionados en esta sesión</> : "Cargando cola…"}</p>
        </div>
        <div className="adm-prospect-tools">
          <select className="admin-inline-input" value={city} onChange={(event) => { setCity(event.target.value); setIndex(0); setSkipped(new Set()); }} aria-label="Ciudad"><option value="">Todas las ciudades</option>{data?.cities.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <button type="button" className="adm-icon-button" onClick={onClose} aria-label="Salir del modo prospección"><X size={18} /></button>
        </div>
      </header>
      {error && <p className="checkout-status">{error}</p>}
      {!current ? <div className="adm-prospect-empty"><h3>{loading ? "Cargando…" : "No quedan colegios por contactar con estos filtros."}</h3>{!loading && <p className="adm-muted">Los intentos sin respuesta vuelven a la cola en 2 días. Cambia la ciudad o quita el filtro de asesor para seguir.</p>}</div>
        : <ProspectCard key={current.id} prospect={current} position={index + 1} batch={rows.length} asesor={asesor} onOpenLead={onOpenLead}
          onSkip={() => dismiss(current.id, false)} onDone={() => dismiss(current.id, true)} />}
    </section>
  </div>;
}

function ProspectCard({ prospect, position, batch, asesor, onSkip, onDone, onOpenLead }: { prospect: Prospect; position: number; batch: number; asesor: string; onSkip: () => void; onDone: () => void; onOpenLead: (id: string) => void }) {
  const [channel, setChannel] = useState<ContactChannel>(mobilesOf(prospect.phone).length ? "whatsapp" : phonesOf(prospect.phone).length ? "call" : "email");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState<string>(lostReasons[0]);
  const [saving, setSaving] = useState(false);
  const phones = phonesOf(prospect.phone);
  const needsDate = outcome === "meeting";
  const defaultDays = outcome === "answered" ? 3 : outcome === "no_answer" ? 2 : 0;

  function pick(next: Outcome) {
    setOutcome(next);
    setDate(next === "meeting" ? "" : next === "answered" || next === "no_answer" ? bogotaDay(next === "answered" ? 3 : 2) : "");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!outcome) return;
    if (needsDate && !date) { toast.error("Indica la fecha de la reunión."); return; }
    setSaving(true);
    const result = await send(`/api/admin/crm/leads/${prospect.id}/outcome`, "POST", { outcome, channel, note, nextFollowUp: date || null, lostReason: outcome === "not_interested" ? reason : undefined, asesor: asesor || undefined }, `${prospect.organization}: ${outcomes.find((item) => item.value === outcome)?.label.toLowerCase()}.`);
    setSaving(false);
    if (result) onDone();
  }

  return <div className="adm-prospect-body">
    <article className="adm-prospect-card">
      <div className="adm-prospect-title">
        <small>{position} de {batch} en este lote · <span className="adm-priority" data-priority={prospect.priority}>{leadPriorityLabel(prospect.priority)}</span>{prospect.attempts > 0 && <> · {prospect.attempts} {prospect.attempts === 1 ? "intento" : "intentos"} sin respuesta</>}</small>
        <h3>{prospect.organization}</h3>
        <p>{prospect.name}{prospect.city && ` · ${prospect.city}`}{prospect.externalId && ` · DANE ${prospect.externalId}`}</p>
      </div>
      <ul className="adm-prospect-contacts">
        {phones.map((phone) => <li key={phone}><Phone size={14} /><a href={`tel:${phone}`}>{phone}</a>{whatsappLink(phone) && <a className="adm-chip" href={whatsappLink(phone)!} target="_blank" rel="noopener noreferrer"><MessageCircle size={12} /> WhatsApp</a>}</li>)}
        {prospect.email && <li><Mail size={14} /><a href={`mailto:${prospect.email}`}>{prospect.email}</a></li>}
        {prospect.website && <li><ExternalLink size={14} /><a href={prospect.website} target="_blank" rel="noopener noreferrer">{prospect.website.replace(/^https?:\/\//, "")}</a></li>}
        {!phones.length && !prospect.email && <li className="adm-muted">Sin teléfono ni correo: marca “Datos errados” o busca el contacto en el sitio web.</li>}
      </ul>
      {prospect.notes && <p className="adm-prospect-notes">{prospect.notes}</p>}
      {prospect.attempts >= MAX_ATTEMPTS && <p className="adm-callout">Ya van {prospect.attempts} intentos sin respuesta. Si no contesta hoy, márcalo como <strong>No interesa · Sin respuesta</strong> para sacarlo de la cola.</p>}
      <div className="adm-prospect-links"><button type="button" className="adm-link-button" onClick={() => onOpenLead(prospect.id)}>Abrir ficha completa</button><button type="button" className="adm-link-button" onClick={onSkip}><SkipForward size={12} /> Saltar por ahora</button></div>
    </article>

    <div className="adm-prospect-work">
      <MessageComposer lead={prospect} asesor={asesor} compact onOpened={(used) => { setChannel(used === "email" ? "email" : "whatsapp"); if (!outcome) setOutcome(null); }} />
      <form className="adm-card adm-outcome" onSubmit={save}>
        <div className="adm-outcome-head">
          <h3>¿Qué pasó?</h3>
          <div className="adm-segmented" role="group" aria-label="Canal de la gestión">{contactChannels.map((item) => <button key={item.value} type="button" aria-pressed={channel === item.value} onClick={() => setChannel(item.value)}>{item.label}</button>)}</div>
        </div>
        <div className="adm-outcomes" role="radiogroup" aria-label="Resultado">
          {outcomes.map((item) => <button key={item.value} type="button" role="radio" aria-checked={outcome === item.value} data-outcome={item.value} className={outcome === item.value ? "is-active" : undefined} onClick={() => pick(item.value)}><strong>{item.label}</strong><small>{item.hint}</small></button>)}
        </div>
        {outcome && <div className="adm-outcome-detail">
          {outcome === "not_interested" && <div className="adm-chip-row" role="radiogroup" aria-label="Motivo">{lostReasons.map((item) => <button key={item} type="button" role="radio" aria-checked={reason === item} className={`adm-chip${reason === item ? " is-active" : ""}`} onClick={() => setReason(item)}>{item}</button>)}</div>}
          {(outcome === "answered" || outcome === "no_answer" || outcome === "meeting") && <div className="adm-followup">
            <label>{outcome === "meeting" ? "Fecha de la reunión" : "Próximo seguimiento"}<input type="date" value={date} required={needsDate} min={bogotaDay()} onChange={(event) => setDate(event.target.value)} /></label>
            {outcome !== "meeting" && <div className="adm-chip-row">{quickDays.map(([label, days]) => <button key={label} type="button" className={`adm-chip${date === bogotaDay(days) ? " is-active" : ""}`} onClick={() => setDate(bogotaDay(days))}>{label}</button>)}</div>}
            {date && <small className="adm-muted">{outcome === "no_answer" ? "Vuelve a la cola el " : "En la agenda el "}{formatDay(date)}{defaultDays && date === bogotaDay(defaultDays) ? " (por defecto)" : ""}</small>}
          </div>}
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={2000} placeholder={outcome === "answered" ? "Qué le interesa, grados, presupuesto, quién decide…" : "Nota opcional"} aria-label="Nota" />
          <button className="button button-dark" type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar y siguiente"}</button>
        </div>}
      </form>
    </div>
  </div>;
}
