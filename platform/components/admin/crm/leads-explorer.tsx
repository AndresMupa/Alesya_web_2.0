"use client";

import { FormEvent, useCallback, useRef, useState } from "react";
import { Download, Plus, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";
import { Drawer, Metric, PageHeader, readTextFile, send, useDebounced, useJson } from "@/components/admin/kit";
import { AsesorPicker, useAsesor } from "@/components/admin/asesor";
import { LeadDrawer } from "@/components/admin/crm/lead-drawer";
import { leadPriorities, leadPriorityLabel, leadSourceLabel, leadSources, leadStageLabel, leadStages, manualLeadSources } from "@/lib/crm/constants";
import { bogotaDay, formatDay, formatMoney } from "@/lib/format";

type Lead = { id: string; name: string; organization: string; email: string | null; phone: string | null; city: string | null; externalId: string | null; source: string; stage: string; owner: string | null; priority: string; lastContact: string | null; nextFollowUp: string | null; estimatedValueInCents: number };
type Result = { rows: Lead[]; page: number; pageSize: number; total: number; metrics: { all: number; due: number; new: number }; owners: string[]; cities: string[] };

export function LeadsExplorer({ initialLead }: { initialLead?: string }) {
  const asesor = useAsesor();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ stage: "", priority: "", source: "", owner: "", city: "", due: false });
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [openLead, setOpenLead] = useState<string | null>(initialLead ?? null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fileInput = useRef<HTMLInputElement>(null);
  const term = useDebounced(search.trim(), 300);

  const params = new URLSearchParams({ page: String(page) });
  if (term) params.set("search", term);
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value === true ? "1" : String(value));
  const { data, error, loading } = useJson<Result>(`/api/admin/crm/leads?${params}`, revision);
  const exportParams = new URLSearchParams(params); exportParams.delete("page");
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const setFilter = (key: keyof typeof filters, value: string | boolean) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); setSelected(new Set()); };
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 40)));
  const today = bogotaDay();
  const pageIds = data?.rows.map((lead) => lead.id) ?? [];
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  function closeLead() {
    setOpenLead(null);
    if (window.location.search.includes("lead=")) window.history.replaceState(null, "", "/admin/crm");
  }

  async function quickStage(lead: Lead, stage: string) {
    if (stage === "lost") { setOpenLead(lead.id); toast.info("Elige el motivo de pérdida en la ficha."); return; }
    if (await send(`/api/admin/crm/leads/${lead.id}`, "PATCH", { stage, ...(asesor && { asesor }) }, `${lead.organization}: ${leadStageLabel(stage)}.`)) reload();
  }

  async function importCsv(file: File) {
    setImporting(true);
    try {
      const result = await send<{ created: number; skipped: number; invalid: number }>("/api/admin/crm/import", "POST", { csv: await readTextFile(file) });
      if (result) { toast.success(`Importación lista: ${result.created} nuevos, ${result.skipped} ya existían${result.invalid ? `, ${result.invalid} filas sin institución` : ""}.`); setPage(1); reload(); }
    } finally { setImporting(false); if (fileInput.current) fileInput.current.value = ""; }
  }

  return <>
    <PageHeader title="CRM · Contactos" description="Colegios, docentes y clientes: busca, filtra, asigna y abre la ficha para registrar cada gestión.">
      <AsesorPicker owners={data?.owners} />
      <button className="refresh-button" onClick={() => setCreating(true)}><Plus size={15} /> Nuevo contacto</button>
      <button className="refresh-button" onClick={() => fileInput.current?.click()} disabled={importing}><Upload size={15} /> {importing ? "Importando…" : "Importar CSV"}</button>
      <a className="refresh-button" href={`/api/admin/crm/export?${exportParams}`}><Download size={15} /> Exportar CSV</a>
      <button className="refresh-button" onClick={reload} disabled={loading}><RefreshCw size={15} /></button>
      <input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void importCsv(file); }} />
    </PageHeader>

    <section className="adm-metrics adm-metrics-3">
      <Metric label="Contactos en la base" value={data?.metrics.all.toLocaleString("es-CO") ?? "—"} />
      <Metric label="Sin contactar" value={data?.metrics.new.toLocaleString("es-CO") ?? "—"} hint={<button type="button" className="adm-link-button" onClick={() => setFilter("stage", "new")}>Ver</button>} />
      <Metric label="Seguimientos vencidos u hoy" value={data?.metrics.due.toLocaleString("es-CO") ?? "—"} tone={data?.metrics.due ? "warning" : undefined} hint={<button type="button" className="adm-link-button" onClick={() => setFilter("due", true)}>Ver</button>} />
    </section>

    <section className="panel adm-section">
      <div className="sales-filters adm-filters">
        <label>Buscar colegio, persona, ciudad, teléfono o DANE<input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar en toda la base" /></label>
        <label>Etapa<select value={filters.stage} onChange={(event) => setFilter("stage", event.target.value)}><option value="">Todas</option>{leadStages.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>Prioridad<select value={filters.priority} onChange={(event) => setFilter("priority", event.target.value)}><option value="">Todas</option>{leadPriorities.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>Origen<select value={filters.source} onChange={(event) => setFilter("source", event.target.value)}><option value="">Todos</option><option value="inbound">Entrantes (no base)</option>{leadSources.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>Ciudad<select value={filters.city} onChange={(event) => setFilter("city", event.target.value)}><option value="">Todas</option>{data?.cities.map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
        <label>Responsable<select value={filters.owner} onChange={(event) => setFilter("owner", event.target.value)}><option value="">Todos</option>{asesor && <option value={asesor}>Míos ({asesor})</option>}<option value="none">Sin asignar</option>{data?.owners.filter((owner) => owner !== asesor).map((owner) => <option key={owner} value={owner}>{owner}</option>)}</select></label>
        <label className="sales-due"><input type="checkbox" checked={filters.due} onChange={(event) => setFilter("due", event.target.checked)} /> Solo seguimientos pendientes</label>
      </div>
      {error && <p className="checkout-status">{error}</p>}
      {selected.size > 0 && <BulkBar count={selected.size} owners={data?.owners ?? []} asesor={asesor} onDone={() => { setSelected(new Set()); reload(); }} ids={Array.from(selected)} onClear={() => setSelected(new Set())} />}
      <div className="sales-table-scroll">
        <table className="admin-table adm-table adm-clickable">
          <thead><tr><th><input type="checkbox" aria-label="Seleccionar la página" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(pageIds))} /></th><th>Institución</th><th>Contacto</th><th>Etapa</th><th>Prioridad</th><th>Responsable</th><th>Seguimiento</th><th>Valor</th></tr></thead>
          <tbody>{data?.rows.length ? data.rows.map((lead) => <tr key={lead.id} className={selected.has(lead.id) ? "is-selected" : undefined} onClick={() => setOpenLead(lead.id)}>
            <td onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label={`Seleccionar ${lead.organization}`} checked={selected.has(lead.id)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(lead.id)) next.delete(lead.id); else next.add(lead.id); return next; })} /></td>
            <td><strong>{lead.organization}</strong><small>{lead.city ?? "Ciudad sin registrar"} · {lead.externalId ? `DANE ${lead.externalId}` : leadSourceLabel(lead.source)}</small></td>
            <td>{lead.name}<small>{lead.email ?? lead.phone?.split(";")[0] ?? "Sin datos de contacto"}</small></td>
            <td onClick={(event) => event.stopPropagation()}><select className="admin-inline-input" aria-label={`Etapa de ${lead.organization}`} value={lead.stage} onChange={(event) => void quickStage(lead, event.target.value)} data-stage={lead.stage}>{leadStages.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></td>
            <td><span className="adm-priority" data-priority={lead.priority}>{leadPriorityLabel(lead.priority)}</span></td>
            <td>{lead.owner ?? <span className="adm-muted">Sin asignar</span>}</td>
            <td><span className={lead.nextFollowUp && lead.nextFollowUp <= today && !["won", "lost"].includes(lead.stage) ? "is-due" : undefined}>{formatDay(lead.nextFollowUp)}</span><small>Último: {formatDay(lead.lastContact)}</small></td>
            <td>{lead.estimatedValueInCents ? formatMoney(lead.estimatedValueInCents) : "—"}</td>
          </tr>) : <tr><td colSpan={8}>{loading ? "Cargando contactos…" : "No hay contactos con estos filtros."}</td></tr>}</tbody>
        </table>
      </div>
      <div className="sales-pagination"><span>{(data?.total ?? 0).toLocaleString("es-CO")} resultados · página {page} de {pages}</span><div><button className="refresh-button" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Anterior</button><button className="refresh-button" disabled={page >= pages || loading} onClick={() => setPage(page + 1)}>Siguiente</button></div></div>
      <p className="adm-hint">Marca varias filas para asignar responsable, prioridad o seguimiento en lote. Importar acepta el CSV que exporta este panel o columnas equivalentes (institucion/colegio, contacto, correo, telefono, ciudad/municipio, codigo_dane…). No duplica: omite filas cuyo código DANE ya existe; las que no traen código se comparan por correo.</p>
    </section>

    <NewLeadDrawer open={creating} asesor={asesor} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setPage(1); reload(); setOpenLead(id); }} onOpenExisting={(id) => { setCreating(false); setOpenLead(id); }} />
    <LeadDrawer leadId={openLead} asesor={asesor} onClose={closeLead} onChanged={reload} />
  </>;
}

function BulkBar({ ids, count, owners, asesor, onDone, onClear }: { ids: string[]; count: number; owners: string[]; asesor: string; onDone: () => void; onClear: () => void }) {
  const [owner, setOwner] = useState(asesor);
  const [priority, setPriority] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);

  async function apply(patch: Record<string, unknown>) {
    setBusy(true);
    const result = await send<{ updated: number }>("/api/admin/crm/leads/bulk", "PATCH", { ids, ...patch, ...(asesor && { asesor }) });
    setBusy(false);
    if (result) { toast.success(`${result.updated} contactos actualizados.`); onDone(); }
  }

  return <div className="adm-bulk-bar" role="region" aria-label="Acciones en lote">
    <strong>{count} seleccionados</strong>
    <label>Asignar a<input list="adm-bulk-owners" value={owner} onChange={(event) => setOwner(event.target.value)} maxLength={120} placeholder="Nombre del asesor" /><datalist id="adm-bulk-owners">{owners.map((item) => <option key={item} value={item} />)}</datalist></label>
    <label>Prioridad<select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="">Sin cambio</option>{leadPriorities.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    <label>Seguimiento<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
    <button type="button" className="button button-dark" disabled={busy || (!owner.trim() && !priority && !date)} onClick={() => void apply({ ...(owner.trim() && { owner: owner.trim() }), ...(priority && { priority }), ...(date && { nextFollowUp: date }) })}>Aplicar</button>
    <button type="button" className="refresh-button" disabled={busy} onClick={() => { if (confirm(`¿Quitar el responsable de ${count} contactos?`)) void apply({ owner: null }); }}>Quitar responsable</button>
    <button type="button" className="adm-link-button" onClick={onClear}>Limpiar selección</button>
  </div>;
}

function NewLeadDrawer({ open, asesor, onClose, onCreated, onOpenExisting }: { open: boolean; asesor: string; onClose: () => void; onCreated: (id: string) => void; onOpenExisting: (id: string) => void }) {
  const [saving, setSaving] = useState(false);
  const [organization, setOrganization] = useState("");
  const [contact, setContact] = useState("");
  const orgTerm = useDebounced(organization.trim(), 350);
  const contactTerm = useDebounced(contact.trim(), 350);
  const { data: orgMatches } = useJson<Result>(open && orgTerm.length >= 4 ? `/api/admin/crm/leads?search=${encodeURIComponent(orgTerm)}` : null);
  const { data: contactMatches } = useJson<Result>(open && contactTerm.length >= 6 ? `/api/admin/crm/leads?search=${encodeURIComponent(contactTerm)}` : null);
  const duplicates = Array.from(new Map([...(orgTerm.length >= 4 ? orgMatches?.rows ?? [] : []), ...(contactTerm.length >= 6 ? contactMatches?.rows ?? [] : [])].map((lead) => [lead.id, lead])).values()).slice(0, 4);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const result = await send<{ id: string }>("/api/admin/crm/leads", "POST", { ...Object.fromEntries(new FormData(event.currentTarget)), ...(asesor && { asesor }) }, "Contacto registrado.");
    setSaving(false);
    if (result) { setOrganization(""); setContact(""); onCreated(result.id); }
  }
  return <Drawer open={open} onClose={onClose} title="Nuevo contacto" subtitle="Registra una conversación de WhatsApp, redes, llamada o evento.">
    <form className="adm-card adm-form" onSubmit={submit}>
      <div className="adm-form-grid">
        <label>Institución<input name="organization" required minLength={2} maxLength={160} placeholder="Colegio u organización" value={organization} onChange={(event) => setOrganization(event.target.value)} /></label>
        <label>Contacto<input name="name" required minLength={2} maxLength={120} placeholder="Nombre o cargo" /></label>
        <label>Correo<input name="email" type="email" maxLength={180} onChange={(event) => setContact(event.target.value)} /></label>
        <label>Teléfono<input name="phone" maxLength={60} onChange={(event) => { if (!contact.includes("@")) setContact(event.target.value); }} /></label>
        <label>Ciudad<input name="city" maxLength={100} /></label>
        <label>Canal<select name="source" defaultValue="whatsapp">{manualLeadSources.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>Prioridad<select name="priority" defaultValue="medium">{leadPriorities.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>Responsable<input name="owner" maxLength={120} defaultValue={asesor} /></label>
        <label>Valor estimado (COP)<input name="estimatedValue" type="number" min="0" step="10000" placeholder="0" /></label>
        <label>Próximo seguimiento<input name="nextFollowUp" type="date" /></label>
      </div>
      {duplicates.length > 0 && <div className="adm-dupes" role="status">
        <strong>Ya existe en la base:</strong>
        <ul>{duplicates.map((lead) => <li key={lead.id}><span>{lead.organization}<small>{lead.city ?? "—"} · {leadStageLabel(lead.stage)}{lead.owner && ` · ${lead.owner}`}</small></span><button type="button" className="refresh-button" onClick={() => onOpenExisting(lead.id)}>Abrir ficha</button></li>)}</ul>
        <small>Si es el mismo colegio, registra la gestión en su ficha en lugar de crear otro contacto.</small>
      </div>}
      <label>Necesidad o conversación<textarea name="message" required minLength={8} maxLength={2000} rows={3} placeholder="Qué pidió y por qué canal llegó" /></label>
      <label>Nota interna<textarea name="notes" maxLength={4000} rows={2} placeholder="Siguiente acción" /></label>
      <button className="button button-dark" type="submit" disabled={saving}>Guardar contacto</button>
    </form>
  </Drawer>;
}
