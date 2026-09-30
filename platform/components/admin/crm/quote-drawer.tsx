"use client";

import { FormEvent, useMemo, useState } from "react";
import { Copy, ExternalLink, Minus, Plus, Search, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Drawer, send, useJson } from "@/components/admin/kit";
import type { AdminProduct } from "@/components/admin/commerce/product-drawer";
import { QUOTE_DEFAULT_TERMS, QUOTE_VALIDITY_DAYS, quoteStatusLabel } from "@/lib/crm/constants";
import { bogotaDay, formatDateTime, formatDay, formatMoney, whatsappLink } from "@/lib/format";

type Item = { description: string; quantity: number; unitPriceInCents: number; productSlug?: string | null };
type Quote = { id: string; leadId: string; number: string; status: string; title: string; items: Item[]; subtotalInCents: number; discountInCents: number; totalInCents: number; validUntil: string | null; notes: string; terms: string; token: string; createdAt: string; sentAt: string | null; decidedAt: string | null; lead: { organization: string; contact: string; email: string | null; phone: string | null; city: string | null } };
export type QuoteLead = { id: string; organization: string; name: string; phone: string | null; email: string | null; city: string | null; program?: string | null };

const quickLines = ["Formación docente (8 horas)", "Acompañamiento pedagógico mensual", "Ruta de proyectos por grado (guías impresas)", "Instalación y puesta en marcha"];

export function QuoteStatusPill({ status }: { status: string }) {
  return <span className="adm-quote-status" data-status={status}>{quoteStatusLabel(status)}</span>;
}

/** Crea o edita una cotización; una vez guardada se puede enviar (enlace público), marcar aceptada o rechazada e imprimir. */
export function QuoteDrawer({ quoteId, lead, asesor, onClose, onChanged }: { quoteId: string | null | "new"; lead: QuoteLead; asesor: string; onClose: () => void; onChanged: () => void }) {
  const [revision, setRevision] = useState(0);
  const { data, error, loading } = useJson<Quote>(quoteId && quoteId !== "new" ? `/api/admin/crm/quotes/${quoteId}` : null, revision);
  const quote = quoteId === "new" ? null : data && data.id === quoteId ? data : null;
  const ready = quoteId === "new" || !!quote;
  return <Drawer open={!!quoteId} onClose={onClose} title={quote ? `${quote.number} · ${quote.title}` : quoteId === "new" ? "Nueva cotización" : (error || "Cargando cotización…")} subtitle={<>{lead.organization}{lead.city && ` · ${lead.city}`}{quote && <> · <QuoteStatusPill status={quote.status} /></>}</>}>
    {!ready ? <p className="adm-muted">{loading ? "Cargando…" : error}</p> : <QuoteForm key={quote?.id ?? "new"} quote={quote} lead={lead} asesor={asesor} onSaved={(id) => { setRevision((value) => value + 1); onChanged(); if (!quote) toast.success(`Cotización guardada. Ahora puedes enviarla.`); void id; }} onClose={onClose} />}
  </Drawer>;
}

function QuoteForm({ quote, lead, asesor, onSaved, onClose }: { quote: Quote | null; lead: QuoteLead; asesor: string; onSaved: (id: string) => void; onClose: () => void }) {
  const { data: catalog } = useJson<{ products: AdminProduct[] }>("/api/admin/commerce/products");
  const [title, setTitle] = useState(quote?.title ?? `Programa de robótica para ${lead.organization}`);
  const [items, setItems] = useState<Item[]>(quote?.items ?? []);
  const [discount, setDiscount] = useState(String(Math.round((quote?.discountInCents ?? 0) / 100)));
  const [validUntil, setValidUntil] = useState(quote?.validUntil ?? bogotaDay(QUOTE_VALIDITY_DAYS));
  const [notes, setNotes] = useState(quote?.notes ?? "");
  const [terms, setTerms] = useState(quote?.terms ?? QUOTE_DEFAULT_TERMS);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(quote?.id ?? null);
  const editable = !quote || ["draft", "sent"].includes(quote.status);
  const sellable = useMemo(() => (catalog?.products ?? []).filter((product) => product.status === "active" && product.priceInCents > 0), [catalog]);
  const term = search.trim().toLowerCase();
  const matches = term.length >= 2 ? sellable.filter((product) => `${product.name} ${product.sku}`.toLowerCase().includes(term)).slice(0, 6) : [];
  const subtotal = items.reduce((acc, item) => acc + Math.round(item.quantity * item.unitPriceInCents), 0);
  const discountInCents = Math.min(subtotal, Math.max(0, Math.round(Number(discount) || 0) * 100));
  const total = subtotal - discountInCents;
  const publicUrl = quote ? `${typeof window !== "undefined" ? window.location.origin : ""}/cotizacion/${quote.token}` : "";
  const stamp = asesor ? { asesor } : {};

  const setItem = (index: number, patch: Partial<Item>) => setItems((current) => current.map((item, position) => position === index ? { ...item, ...patch } : item));
  const addLine = (item: Item) => setItems((current) => [...current, item]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!items.length) { toast.error("Agrega al menos un renglón."); return; }
    const payload = { title: title.trim(), items: items.map((item) => ({ ...item, quantity: Number(item.quantity) || 1, unitPriceInCents: Math.round(item.unitPriceInCents) })), discountInCents, validUntil: validUntil || null, notes, terms, ...stamp };
    setSaving(true);
    const result = quote
      ? await send(`/api/admin/crm/quotes/${quote.id}`, "PATCH", { action: "update", ...payload }, "Cotización actualizada.")
      : await send<{ id: string; number: string }>("/api/admin/crm/quotes", "POST", { leadId: lead.id, ...payload });
    setSaving(false);
    if (result) { const id = quote?.id ?? (result as { id?: string }).id ?? null; setSavedId(id); onSaved(id ?? ""); }
  }

  async function setStatus(status: "sent" | "accepted" | "rejected" | "expired") {
    if (!quote) return;
    const labels = { sent: "¿Marcar como enviada? La oportunidad pasa a Propuesta.", accepted: "¿Marcar como aceptada? La oportunidad se gana con el valor de la cotización.", rejected: "¿Marcar como rechazada?", expired: "¿Marcar como vencida?" };
    if (!confirm(labels[status])) return;
    setSaving(true);
    const result = await send(`/api/admin/crm/quotes/${quote.id}`, "PATCH", { action: "status", status, ...stamp }, `Cotización ${quoteStatusLabel(status).toLowerCase()}.`);
    setSaving(false);
    if (result) onSaved(quote.id);
  }

  const message = quote ? `Hola ${lead.name.split(" ")[0]}, le comparto la cotización ${quote.number} para ${lead.organization}: ${publicUrl}\n\nVigente hasta el ${formatDay(quote.validUntil)}. Desde el enlace puede revisarla, imprimirla y aceptarla. Quedo atento a sus comentarios.${asesor ? `\n\n${asesor} · Alesya X-Tech` : ""}` : "";
  const wa = quote ? whatsappLink(lead.phone, message) : null;

  return <div className="adm-lead">
    {quote && <section className="adm-card adm-quote-actions">
      <div className="adm-actions-row">
        <a className="refresh-button" href={`/cotizacion/${quote.token}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Ver / imprimir</a>
        {quote.status === "draft" && <button type="button" className="button button-primary" disabled={saving} onClick={() => void setStatus("sent")}><Send size={15} /> Marcar enviada</button>}
        {quote.status === "sent" && <><button type="button" className="button button-dark" disabled={saving} onClick={() => void setStatus("accepted")}>Aceptada</button><button type="button" className="refresh-button" disabled={saving} onClick={() => void setStatus("rejected")}>Rechazada</button><button type="button" className="refresh-button" disabled={saving} onClick={() => void setStatus("expired")}>Vencida</button></>}
        {(quote.status === "rejected" || quote.status === "expired") && <button type="button" className="refresh-button" disabled={saving} onClick={() => void setStatus("sent")}><Send size={14} /> Reenviar</button>}
      </div>
      <div className="adm-paylink"><input readOnly value={publicUrl} aria-label="Enlace público de la cotización" onFocus={(event) => event.currentTarget.select()} /><button type="button" className="refresh-button" onClick={() => { void navigator.clipboard.writeText(publicUrl).then(() => toast.success("Enlace copiado."), () => toast.error("No se pudo copiar.")); }}><Copy size={14} /> Copiar</button></div>
      <div className="adm-composer-actions">
        {wa ? <a className="button button-primary" href={wa} target="_blank" rel="noopener noreferrer" onClick={() => { if (quote.status === "draft") void setStatus("sent"); }}><ExternalLink size={15} /> Enviar por WhatsApp</a> : <span className="adm-muted">Sin celular para WhatsApp.</span>}
        {lead.email && <a className="refresh-button" href={`mailto:${lead.email}?subject=${encodeURIComponent(`Cotización ${quote.number} · Alesya X-Tech`)}&body=${encodeURIComponent(message)}`}>Enviar por correo</a>}
        <button type="button" className="refresh-button" onClick={() => { void navigator.clipboard.writeText(message).then(() => toast.success("Mensaje copiado."), () => toast.error("No se pudo copiar.")); }}><Copy size={14} /> Copiar mensaje</button>
      </div>
      <p className="adm-muted adm-small">Creada {formatDateTime(quote.createdAt)}{quote.sentAt && ` · enviada ${formatDateTime(quote.sentAt)}`}{quote.decidedAt && ` · decidida ${formatDateTime(quote.decidedAt)}`}{quote.lead.city && ` · ${quote.lead.city}`}</p>
    </section>}

    <form className="adm-card adm-form" onSubmit={save}>
      <label>Título<input value={title} onChange={(event) => setTitle(event.target.value)} required minLength={3} maxLength={160} disabled={!editable} /></label>
      <h3>Renglones</h3>
      {editable && <>
        <label className="adm-search-line"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar producto del catálogo por nombre o SKU" aria-label="Buscar producto" /></label>
        {matches.length > 0 && <ul className="adm-picker">{matches.map((product) => <li key={product.id}><button type="button" onClick={() => { addLine({ description: product.name, quantity: 1, unitPriceInCents: product.priceInCents, productSlug: product.slug }); setSearch(""); }}><span className="adm-picker-icon">{product.sku.slice(0, 3)}</span><span><strong>{product.name}</strong><small>{product.sku}</small></span><b>{formatMoney(product.priceInCents)}</b></button></li>)}</ul>}
        <div className="adm-chip-row">{quickLines.map((line) => <button key={line} type="button" className="adm-chip" onClick={() => addLine({ description: line, quantity: 1, unitPriceInCents: 0 })}>+ {line}</button>)}<button type="button" className="adm-chip" onClick={() => addLine({ description: "", quantity: 1, unitPriceInCents: 0 })}><Plus size={12} /> Renglón libre</button></div>
      </>}
      {items.length ? <table className="admin-table adm-table adm-quote-items">
        <thead><tr><th>Descripción</th><th>Cant.</th><th>Unitario (COP)</th><th>Total</th>{editable && <th />}</tr></thead>
        <tbody>{items.map((item, index) => <tr key={index}>
          <td><input value={item.description} onChange={(event) => setItem(index, { description: event.target.value })} required minLength={2} maxLength={200} placeholder="Descripción" disabled={!editable} /></td>
          <td><div className="store-qty"><button type="button" disabled={!editable} onClick={() => setItem(index, { quantity: Math.max(0.5, item.quantity - 1) })} aria-label="Menos"><Minus size={12} /></button><input value={item.quantity} inputMode="decimal" aria-label="Cantidad" disabled={!editable} onChange={(event) => setItem(index, { quantity: Number(event.target.value.replace(",", ".")) || 0 })} /><button type="button" disabled={!editable} onClick={() => setItem(index, { quantity: item.quantity + 1 })} aria-label="Más"><Plus size={12} /></button></div></td>
          <td><input type="number" min="0" step="1000" value={Math.round(item.unitPriceInCents / 100)} onChange={(event) => setItem(index, { unitPriceInCents: (Number(event.target.value) || 0) * 100 })} disabled={!editable} aria-label="Precio unitario" /></td>
          <td><strong>{formatMoney(Math.round(item.quantity * item.unitPriceInCents))}</strong></td>
          {editable && <td><button type="button" className="store-remove" onClick={() => setItems((current) => current.filter((_, position) => position !== index))} aria-label="Quitar renglón"><Trash2 size={14} /></button></td>}
        </tr>)}</tbody>
      </table> : <p className="adm-muted">Agrega productos del catálogo o renglones libres (formación, acompañamiento, instalación…).</p>}
      <div className="adm-form-grid">
        <label>Descuento (COP)<input type="number" min="0" step="1000" value={discount} onChange={(event) => setDiscount(event.target.value)} disabled={!editable} /></label>
        <label>Vigente hasta<input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} disabled={!editable} /></label>
      </div>
      <div className="adm-totals"><span>Subtotal</span><b>{formatMoney(subtotal)}</b><span>Descuento</span><b>{discountInCents ? `− ${formatMoney(discountInCents)}` : "—"}</b><span>Total</span><strong>{formatMoney(total)}</strong></div>
      <label>Notas para el colegio<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} maxLength={2000} placeholder="Alcance, cronograma propuesto, qué incluye…" disabled={!editable} /></label>
      <label>Condiciones<textarea value={terms} onChange={(event) => setTerms(event.target.value)} rows={3} maxLength={2000} disabled={!editable} /></label>
      {editable ? <div className="adm-actions-row"><button className="button button-dark" type="submit" disabled={saving}>{quote ? "Guardar cambios" : "Guardar cotización"}</button>{!quote && <button type="button" className="refresh-button" onClick={onClose}>Cancelar</button>}</div>
        : <p className="adm-muted">Esta cotización ya fue {quoteStatusLabel(quote!.status).toLowerCase()}: para cambiar precios crea una nueva versión.</p>}
      {savedId && !quote && <p className="adm-hint">Guardada. Cierra y vuelve a abrirla desde la lista para enviarla.</p>}
    </form>
  </div>;
}
