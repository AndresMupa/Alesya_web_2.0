"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { leadStages } from "@/lib/statuses";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Lead = { id: string; name: string; organization: string; email: string | null; phone: string | null; city: string | null; externalId: string | null; website: string | null; message: string; source: string; stage: string; owner: string | null; priority: string; notes: string; lastContact: string | null; nextFollowUp: string | null };
type Result = { rows: Lead[]; page: number; pageSize: number; total: number; metrics: { all: number; due: number; new: number } };
const priorities = [{ value: "high", label: "Alta" }, { value: "medium", label: "Media" }, { value: "low", label: "Baja" }];
const sources = ["base_colegios_2026", "website", "linkedin", "instagram", "facebook", "whatsapp", "manual"];
const campaign = "/colegios?utm_campaign=colegios_2026&utm_source=";

export function SalesWorkbench() {
  const [result, setResult] = useState<Result | null>(null);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [priority, setPriority] = useState("");
  const [source, setSource] = useState("");
  const [due, setDue] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const [showCreate, setShowCreate] = useState(false);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set("search", search);
      if (stage) params.set("stage", stage);
      if (priority) params.set("priority", priority);
      if (source) params.set("source", source);
      if (due) params.set("due", "1");
      try {
        const response = await fetch(`/api/admin/sales/leads?${params}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("No se pudo cargar el CRM.");
        setResult(await response.json());
        setNotice("");
      } catch (error) {
        if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : "No se pudo cargar el CRM.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, stage, priority, source, due, page, revision]);

  async function update(id: string, fields: Record<string, string | null>) {
    setNotice("Guardando…");
    try {
      const response = await fetch("/api/admin/leads", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, ...fields }) });
      if (!response.ok) throw new Error("No se pudo guardar el cambio.");
      reload();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo guardar el cambio.");
    }
  }

  async function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setNotice("Guardando contacto…");
    try {
      const response = await fetch("/api/admin/sales/leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(data.message ?? "No se pudo crear la oportunidad.");
      }
      form.reset();
      setShowCreate(false);
      setPage(1);
      reload();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo crear la oportunidad.");
    }
  }

  const setFilter = (setter: (value: string) => void, value: string) => { setter(value); setPage(1); };
  const pages = Math.max(1, Math.ceil((result?.total ?? 0) / (result?.pageSize ?? 40)));
  return <section className="panel sales-workbench" id="ventas">
    <div className="panel-header"><div><h2>Máquina de ventas · colegios</h2><p>Prospección, seguimiento y resultados en una sola base.</p></div><div className="sales-header-actions"><button className="refresh-button" onClick={() => setShowCreate(!showCreate)}>{showCreate ? "Cerrar" : "+ Registrar contacto"}</button><button className="refresh-button" onClick={reload} disabled={loading}><RefreshCw size={15} /> Actualizar</button></div></div>
    {showCreate && <form className="sales-create" onSubmit={createLead}>
      <h3>Registrar conversación u oportunidad</h3>
      <div><label>Contacto<input name="name" required minLength={2} maxLength={120} placeholder="Nombre o Equipo directivo" /></label><label>Institución<input name="organization" required minLength={2} maxLength={160} /></label><label>Canal<select name="source" defaultValue="whatsapp"><option value="whatsapp">WhatsApp</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="linkedin">LinkedIn</option><option value="website">Sitio web</option><option value="manual">Otro</option></select></label><label>Prioridad<select name="priority" defaultValue="medium">{priorities.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>Correo<input type="email" name="email" /></label><label>Teléfono<input name="phone" maxLength={30} /></label><label>Ciudad<input name="city" maxLength={100} /></label></div>
      <label>Necesidad o conversación<textarea name="message" required minLength={8} maxLength={2000} rows={2} placeholder="Qué pidió el colegio y por qué canal llegó" /></label>
      <label>Nota interna<textarea name="notes" maxLength={4000} rows={2} placeholder="Siguiente acción" /></label>
      <button className="button button-dark" type="submit">Guardar oportunidad</button>
    </form>}
    <div className="sales-metrics"><div><span>Colegios y contactos</span><strong>{result?.metrics.all ?? "—"}</strong></div><div><span>Sin contactar</span><strong>{result?.metrics.new ?? "—"}</strong></div><div><span>Seguimientos pendientes</span><strong>{result?.metrics.due ?? "—"}</strong></div></div>
    <div className="sales-channel-links"><span>Enlaces para campañas</span>{["linkedin", "instagram", "facebook", "whatsapp"].map((channel) => <div className="sales-channel" key={channel}><a href={`${campaign}${channel}`} target="_blank" rel="noopener noreferrer">{channel}<ArrowUpRight size={14} /></a><button type="button" onClick={() => { void navigator.clipboard.writeText(`${window.location.origin}${campaign}${channel}`).then(() => setNotice(`Enlace de ${channel} copiado.`), () => setNotice("No se pudo copiar el enlace.")); }}>Copiar</button></div>)}</div>
    <p className="sales-channel-note">Publica estos enlaces en cada canal. Registra aquí los mensajes directos con “+ Registrar contacto”; los formularios entran automáticamente.</p>
    <div className="sales-filters"><label>Buscar colegio, persona, ciudad o DANE<input value={search} onChange={(event) => setFilter(setSearch, event.target.value)} placeholder="Buscar en toda la base" /></label><label>Etapa<select value={stage} onChange={(event) => setFilter(setStage, event.target.value)}><option value="">Todas</option>{leadStages.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>Prioridad<select value={priority} onChange={(event) => setFilter(setPriority, event.target.value)}><option value="">Todas</option>{priorities.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>Origen<select value={source} onChange={(event) => setFilter(setSource, event.target.value)}><option value="">Todos</option>{sources.map((item) => <option key={item} value={item}>{item === "base_colegios_2026" ? "Base 2026" : item}</option>)}</select></label><label className="sales-due"><input type="checkbox" checked={due} onChange={(event) => { setDue(event.target.checked); setPage(1); }} /> Solo pendientes</label></div>
    {notice && <p className="admin-notice" role="status">{notice}</p>}
    <div className="sales-table-scroll"><Table className="admin-table sales-table"><TableHeader><TableRow><TableHead>Institución</TableHead><TableHead>Contacto</TableHead><TableHead>Etapa y prioridad</TableHead><TableHead>Responsable</TableHead><TableHead>Seguimiento</TableHead><TableHead>Nota comercial</TableHead></TableRow></TableHeader><TableBody>{result?.rows.length ? result.rows.map((lead) => <TableRow key={lead.id}>
      <TableCell><strong>{lead.organization}</strong><small>{lead.city ?? "Ciudad sin registrar"} · {lead.externalId ?? lead.source}</small>{lead.website && <small><a href={lead.website} target="_blank" rel="noopener noreferrer">Sitio web ↗</a></small>}</TableCell>
      <TableCell><strong>{lead.name}</strong><small>{lead.email ? <a href={`mailto:${lead.email}`}>{lead.email}</a> : "Sin correo"}</small>{lead.phone && <small><a href={`tel:${lead.phone.split(";")[0]}`}>{lead.phone}</a></small>}</TableCell>
      <TableCell><select aria-label={`Etapa de ${lead.organization}`} value={lead.stage} onChange={(event) => void update(lead.id, { stage: event.target.value })}>{leadStages.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><select aria-label={`Prioridad de ${lead.organization}`} value={lead.priority} onChange={(event) => void update(lead.id, { priority: event.target.value })}>{priorities.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><small>{lead.source}</small></TableCell>
      <TableCell><input aria-label={`Responsable de ${lead.organization}`} defaultValue={lead.owner ?? ""} placeholder="Asignar" maxLength={120} onBlur={(event) => { const value = event.currentTarget.value.trim(); if (value !== (lead.owner ?? "")) void update(lead.id, { owner: value }); }} /></TableCell>
      <TableCell><label>Último contacto<input type="date" value={lead.lastContact ?? ""} onChange={(event) => void update(lead.id, { lastContact: event.target.value || null })} /></label><label>Próximo<input type="date" value={lead.nextFollowUp ?? ""} onChange={(event) => void update(lead.id, { nextFollowUp: event.target.value || null })} /></label></TableCell>
      <TableCell><textarea aria-label={`Nota de ${lead.organization}`} defaultValue={lead.notes} rows={2} placeholder="Resultado y siguiente acción" onBlur={(event) => { const value = event.currentTarget.value.trim(); if (value !== lead.notes) void update(lead.id, { notes: value }); }} /></TableCell>
    </TableRow>) : <TableRow><TableCell colSpan={6}>{loading ? "Cargando colegios…" : "No hay colegios con estos filtros."}</TableCell></TableRow>}</TableBody></Table></div>
    <div className="sales-pagination"><span>{result?.total ?? 0} resultados · página {page} de {pages}</span><div><button className="refresh-button" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Anterior</button><button className="refresh-button" disabled={page >= pages || loading} onClick={() => setPage(page + 1)}>Siguiente</button></div></div>
  </section>;
}
