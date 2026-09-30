"use client";

import { useCallback, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Metric, useDebounced, useJson } from "@/components/admin/kit";
import { QuoteDrawer, QuoteStatusPill, type QuoteLead } from "@/components/admin/crm/quote-drawer";
import { quoteStatuses } from "@/lib/crm/constants";
import { bogotaDay, formatDay, formatMoney, formatMoneyCompact } from "@/lib/format";

type Row = { id: string; leadId: string; number: string; status: string; title: string; totalInCents: number; validUntil: string | null; token: string; createdBy: string | null; sentAt: string | null; decidedAt: string | null; createdAt: string; organization: string; contact: string; city: string | null; phone: string | null; email: string | null };
type Result = { rows: Row[]; summary: { status: string; total: number; valueInCents: number }[] };

/** Todas las cotizaciones del equipo: pipeline de propuestas, vencimientos y aceptación. */
export function QuotesList({ asesor }: { asesor: string }) {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);
  const [open, setOpen] = useState<Row | null>(null);
  const term = useDebounced(search.trim(), 300);
  const params = new URLSearchParams({ ...(status && { status }), ...(term && { search: term }) });
  const { data, error, loading } = useJson<Result>(`/api/admin/crm/quotes?${params}`, revision);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const sum = (key: string) => data?.summary.find((row) => row.status === key);
  const today = bogotaDay();
  const lead = (row: Row): QuoteLead => ({ id: row.leadId, organization: row.organization, name: row.contact, phone: row.phone, email: row.email, city: row.city });

  return <>
    <section className="adm-metrics adm-metrics-4">
      <Metric label="Enviadas (en evaluación)" value={formatMoneyCompact(sum("sent")?.valueInCents ?? 0)} hint={`${sum("sent")?.total ?? 0} cotizaciones`} />
      <Metric label="Aceptadas" value={formatMoneyCompact(sum("accepted")?.valueInCents ?? 0)} hint={`${sum("accepted")?.total ?? 0} cotizaciones`} tone="good" />
      <Metric label="Rechazadas o vencidas" value={(sum("rejected")?.total ?? 0) + (sum("expired")?.total ?? 0)} hint={formatMoneyCompact((sum("rejected")?.valueInCents ?? 0) + (sum("expired")?.valueInCents ?? 0))} />
      <Metric label="Tasa de aceptación" value={(() => { const won = sum("accepted")?.total ?? 0, lost = (sum("rejected")?.total ?? 0) + (sum("expired")?.total ?? 0); return won + lost ? `${Math.round((won / (won + lost)) * 100)}%` : "—"; })()} hint="Aceptadas sobre decididas" />
    </section>
    <section className="panel adm-section">
      <div className="adm-toolbar">
        <div className="admin-tabs" role="tablist" aria-label="Estado"><button role="tab" aria-selected={status === ""} className={status === "" ? "is-active" : ""} onClick={() => setStatus("")}>Todas</button>{quoteStatuses.map((item) => <button key={item.value} role="tab" aria-selected={status === item.value} className={status === item.value ? "is-active" : ""} onClick={() => setStatus(item.value)}>{item.label} <span>{sum(item.value)?.total ?? 0}</span></button>)}</div>
        <div className="adm-toolbar-end"><label className="adm-search"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar número, título o colegio" aria-label="Buscar cotizaciones" /></label><button className="refresh-button" onClick={reload} disabled={loading}><RefreshCw size={15} /></button></div>
      </div>
      {error && <p className="checkout-status">{error}</p>}
      <div className="sales-table-scroll"><table className="admin-table adm-table adm-clickable">
        <thead><tr><th>Cotización</th><th>Colegio</th><th>Estado</th><th>Vigencia</th><th>Total</th><th>Asesor</th></tr></thead>
        <tbody>{data?.rows.length ? data.rows.map((row) => <tr key={row.id} onClick={() => setOpen(row)}>
          <td><strong>{row.number}</strong><small>{row.title}</small></td>
          <td>{row.organization}<small>{row.contact}{row.city && ` · ${row.city}`}</small></td>
          <td><QuoteStatusPill status={row.status} /></td>
          <td><span className={row.status === "sent" && row.validUntil && row.validUntil < today ? "is-due" : undefined}>{formatDay(row.validUntil)}</span><small>creada {formatDay(row.createdAt.slice(0, 10))}</small></td>
          <td><strong>{formatMoney(row.totalInCents)}</strong></td>
          <td>{row.createdBy ?? "—"}</td>
        </tr>) : <tr><td colSpan={6}>{loading ? "Cargando cotizaciones…" : "Sin cotizaciones con estos filtros. Se crean desde la ficha de cada colegio."}</td></tr>}</tbody>
      </table></div>
      <p className="adm-hint">Una cotización enviada pasa la oportunidad a Propuesta; al aceptarse (desde el panel o desde el enlace público) la oportunidad se gana con ese valor. Las vencidas sin respuesta aparecen en el resumen diario.</p>
    </section>
    {open && <QuoteDrawer quoteId={open.id} lead={lead(open)} asesor={asesor} onClose={() => setOpen(null)} onChanged={reload} />}
  </>;
}
