"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarClock, Flag, MessageCircle, Play, RefreshCw, School, Users } from "lucide-react";
import { toast } from "sonner";
import { ColumnChart } from "@/components/admin/charts";
import { Metric, PageHeader, useJson } from "@/components/admin/kit";
import { AsesorPicker, useAsesor } from "@/components/admin/asesor";
import { LeadDrawer } from "@/components/admin/crm/lead-drawer";
import { PipelineBoard, type PipelineCard, type PipelineColumn } from "@/components/admin/crm/pipeline-board";
import { ProspectingMode } from "@/components/admin/crm/prospecting-mode";
import { campaignChannels, leadStageLabel } from "@/lib/crm/constants";
import { bogotaDay, formatDay, formatMoney, formatMoneyCompact, plural, whatsappLink } from "@/lib/format";

type Metrics = { pipeline: { open: number; valueInCents: number }; wonThisMonth: { total: number; valueInCents: number }; lostThisMonth: number; winRate: number | null; dueFollowUps: number; inboundNew: number; prospectsUntouched: number; touchesThisWeek: number; touchesToday: number };
type AgendaItem = PipelineCard & { notes: string };
type Pipeline = { columns: PipelineColumn[]; prospects: number; metrics: Metrics; agenda: AgendaItem[]; queue: PipelineCard[]; queueTotal: number; owners: string[]; cities: string[]; dailyGoal: number };
type Stats = {
  activityByDay: { day: string; total: number }[];
  owners: { owner: string; assigned: number; open: number; valueInCents: number; won30: number; wonValueInCents30: number; lost30: number; due: number; touchesWeek: number; touchesMonth: number }[];
  sources: { source: string; label: string; total: number; open: number; won: number; lost: number; winRate: number | null }[];
  lostReasons: { reason: string; total: number }[];
};

const campaign = "/colegios?utm_campaign=colegios_2026&utm_source=";
const shortDate = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short" });
const dayLabel = (day: string) => shortDate.format(new Date(`${day}T05:00:00Z`));

/**
 * Máquina de ventas: métricas del embudo, agenda de seguimientos, cola de prospección de la base de
 * colegios (con modo guiado), tablero por etapas y rendimiento del equipo. Toda gestión se registra
 * desde la ficha del contacto o desde el modo prospección.
 */
export function SalesMachine() {
  const asesor = useAsesor();
  const [scope, setScope] = useState("");
  const [queueCity, setQueueCity] = useState("");
  const [revision, setRevision] = useState(0);
  const [openLead, setOpenLead] = useState<string | null>(null);
  const [prospecting, setProspecting] = useState(false);
  const owner = scope === "mine" ? asesor : scope;
  const params = new URLSearchParams({ ...(owner && { owner }), ...(queueCity && { city: queueCity }) });
  const { data, error, loading } = useJson<Pipeline>(`/api/admin/crm/pipeline?${params}`, revision);
  const { data: stats } = useJson<Stats>("/api/admin/crm/stats", revision);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const today = bogotaDay();
  const metrics = data?.metrics;

  return <>
    <PageHeader title="Máquina de ventas" description="Prospecta la base de colegios, atiende los contactos entrantes, da seguimiento y cierra.">
      <AsesorPicker owners={data?.owners} />
      <button className="button button-primary adm-cta" onClick={() => setProspecting(true)}><Play size={15} /> Modo prospección</button>
      <Link className="refresh-button" href="/admin/crm">Ver base completa</Link>
      <button className="refresh-button" onClick={reload} disabled={loading}><RefreshCw size={15} /> {loading ? "Cargando…" : "Actualizar"}</button>
    </PageHeader>
    {error && <p className="checkout-status">{error}</p>}

    <div className="adm-scope">
      <Users size={15} />
      <label>Ver<select className="admin-inline-input" value={scope} onChange={(event) => setScope(event.target.value)}>
        <option value="">Todo el equipo</option>
        <option value="mine" disabled={!asesor}>{asesor ? `Mis oportunidades (${asesor})` : "Mis oportunidades (escribe tu nombre)"}</option>
        <option value="none">Sin asignar</option>
        {data?.owners.filter((item) => item !== asesor).map((item) => <option key={item} value={item}>{item}</option>)}
      </select></label>
      <span className="adm-muted">Aplica a la agenda, la cola y el embudo.</span>
    </div>

    {metrics && data && <section className="adm-today">
      <div>
        <p className="adm-today-label"><Flag size={14} /> Hoy</p>
        <h2>{metrics.touchesToday} de {data.dailyGoal} gestiones</h2>
        <div className="adm-progress" role="progressbar" aria-valuemin={0} aria-valuemax={data.dailyGoal} aria-valuenow={metrics.touchesToday}><i style={{ width: `${Math.min(100, Math.round((metrics.touchesToday / data.dailyGoal) * 100))}%` }} /></div>
        <p>{metrics.touchesToday >= data.dailyGoal ? "Meta del día cumplida. Lo que sigue es ganancia." : `Faltan ${data.dailyGoal - metrics.touchesToday} para la meta diaria${metrics.dueFollowUps ? ` · ${metrics.dueFollowUps} seguimientos por atender` : ""}${metrics.inboundNew ? ` · ${metrics.inboundNew} entrantes esperan respuesta` : ""}.`}</p>
      </div>
      <button className="button button-primary" onClick={() => setProspecting(true)}><Play size={15} /> {metrics.dueFollowUps ? "Prospectar" : "Empezar a prospectar"}</button>
    </section>}

    <section className="adm-metrics">
      <Metric label="Embudo abierto" value={metrics ? formatMoneyCompact(metrics.pipeline.valueInCents) : "—"} hint={metrics && plural(metrics.pipeline.open, "oportunidad en curso", "oportunidades en curso")} />
      <Metric label="Ganado este mes" value={metrics ? formatMoneyCompact(metrics.wonThisMonth.valueInCents) : "—"} hint={metrics && `${plural(metrics.wonThisMonth.total, "cierre", "cierres")} · ${metrics.lostThisMonth} perdidos`} tone="good" />
      <Metric label="Tasa de cierre" value={metrics?.winRate === null || !metrics ? "—" : `${metrics.winRate}%`} hint="Ganados sobre cerrados" />
      <Metric label="Seguimientos vencidos u hoy" value={metrics?.dueFollowUps ?? "—"} hint={metrics && plural(metrics.touchesThisWeek, "gestión en 7 días", "gestiones en 7 días")} tone={metrics?.dueFollowUps ? "warning" : undefined} />
      <Metric label="Entrantes sin atender" value={metrics?.inboundNew ?? "—"} hint={metrics && `${metrics.prospectsUntouched.toLocaleString("es-CO")} colegios por prospectar`} tone={metrics?.inboundNew ? "warning" : undefined} />
    </section>

    <section className="adm-two-col">
      <article className="panel">
        <div className="panel-header"><h2><CalendarClock size={17} /> Agenda de seguimientos</h2><span>Vencidos, hoy y próximos 7 días</span></div>
        {data?.agenda.length ? <ul className="adm-agenda">{data.agenda.map((item) => {
          const state = item.nextFollowUp! < today ? "overdue" : item.nextFollowUp === today ? "today" : "soon";
          const wa = whatsappLink(item.phone);
          return <li key={item.id} data-state={state}>
            <button type="button" onClick={() => setOpenLead(item.id)}>
              <time>{state === "overdue" ? "Vencido · " : state === "today" ? "Hoy · " : ""}{formatDay(item.nextFollowUp)}</time>
              <strong>{item.organization}</strong>
              <span>{leadStageLabel(item.stage)}{item.owner && ` · ${item.owner}`}{item.estimatedValueInCents > 0 && ` · ${formatMoney(item.estimatedValueInCents)}`}</span>
              {item.notes && <small>{item.notes.slice(0, 120)}</small>}
            </button>
            {wa && <a className="adm-agenda-wa" href={wa} target="_blank" rel="noopener noreferrer" title="WhatsApp" aria-label={`WhatsApp a ${item.organization}`}><MessageCircle size={15} /></a>}
          </li>;
        })}</ul> : <p className="adm-muted">{loading ? "Cargando…" : "No hay seguimientos programados. Programa el siguiente paso al registrar cada gestión."}</p>}
      </article>
      <article className="panel">
        <div className="panel-header"><h2><School size={17} /> Cola de prospección</h2><select className="admin-inline-input" value={queueCity} onChange={(event) => setQueueCity(event.target.value)} aria-label="Ciudad de la cola"><option value="">Todas las ciudades</option>{data?.cities.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
        {data?.queue.length ? <ul className="adm-queue">{data.queue.map((item) => <li key={item.id}>
          <div><strong>{item.organization}</strong><span>{item.city ?? "Ciudad sin registrar"}{item.phone ? ` · ${item.phone.split(";")[0]}` : ""}</span></div>
          <button type="button" className="refresh-button" onClick={() => setOpenLead(item.id)}>Ficha</button>
        </li>)}</ul> : <p className="adm-muted">{loading ? "Cargando…" : "No quedan colegios sin contactar con estos filtros."}</p>}
        <div className="adm-queue-foot">
          <span className="adm-muted">{data ? `${data.queueTotal.toLocaleString("es-CO")} en cola` : ""}</span>
          <button type="button" className="button button-dark" onClick={() => setProspecting(true)}><Play size={14} /> Empezar a prospectar</button>
        </div>
        <p className="adm-hint">El modo prospección recorre la cola uno por uno con la plantilla lista y registra el resultado en un clic. Los intentos sin respuesta vuelven a la cola en 2 días.</p>
      </article>
    </section>

    <section className="panel adm-section">
      <div className="panel-header"><div><h2>Embudo por etapas</h2><p className="adm-muted">Arrastra una tarjeta para cambiar su etapa. Clic para abrir la ficha.</p></div></div>
      {data ? <PipelineBoard columns={data.columns} onOpen={setOpenLead} onMoved={reload} /> : <p className="adm-muted">{loading ? "Cargando embudo…" : ""}</p>}
    </section>

    <section className="panel adm-section">
      <div className="panel-header"><div><h2>Gestiones por día</h2><p className="adm-muted">Últimos 14 días. Las columnas que alcanzan la meta diaria ({data?.dailyGoal ?? "—"}) se resaltan.</p></div></div>
      {stats ? <ColumnChart data={stats.activityByDay.map((row) => ({ dia: dayLabel(row.day), gestiones: row.total }))} x="dia" y="gestiones" unit="gestiones" goal={data?.dailyGoal} highlightLast={false} /> : <p className="adm-muted">{loading ? "Cargando…" : ""}</p>}
    </section>

    <section className="adm-two-col">
      <article className="panel">
        <div className="panel-header"><h2>Rendimiento por asesor</h2><span>Según responsable del contacto</span></div>
        {stats?.owners.length ? <div className="sales-table-scroll"><table className="admin-table adm-table adm-stats">
          <thead><tr><th>Asesor</th><th>Asignados</th><th>Abiertas</th><th>Gestiones 7 d / 30 d</th><th>Ganadas 30 d</th><th>Perdidas 30 d</th><th>Vencidos</th></tr></thead>
          <tbody>{stats.owners.map((row) => <tr key={row.owner}>
            <td><strong>{row.owner}</strong></td>
            <td>{row.assigned.toLocaleString("es-CO")}</td>
            <td>{row.open}{row.valueInCents > 0 && <small>{formatMoneyCompact(row.valueInCents)}</small>}</td>
            <td>{row.touchesWeek} / {row.touchesMonth}</td>
            <td className="is-positive">{row.won30}{row.wonValueInCents30 > 0 && <small>{formatMoneyCompact(row.wonValueInCents30)}</small>}</td>
            <td>{row.lost30}</td>
            <td className={row.due ? "is-due" : undefined}>{row.due}</td>
          </tr>)}</tbody>
        </table></div> : <p className="adm-muted">Asigna responsables a los contactos (ficha, tabla del CRM o acciones masivas) para ver el rendimiento de cada asesor.</p>}
      </article>
      <article className="panel">
        <div className="panel-header"><h2>Conversión por canal</h2><span>De dónde salen los cierres</span></div>
        {stats?.sources.length ? <div className="sales-table-scroll"><table className="admin-table adm-table adm-stats">
          <thead><tr><th>Canal</th><th>Contactos</th><th>Abiertas</th><th>Ganadas</th><th>Cierre</th></tr></thead>
          <tbody>{stats.sources.map((row) => <tr key={row.source}><td>{row.label}</td><td>{row.total.toLocaleString("es-CO")}</td><td>{row.open}</td><td className="is-positive">{row.won}</td><td>{row.winRate === null ? "—" : `${row.winRate}%`}</td></tr>)}</tbody>
        </table></div> : <p className="adm-muted">Sin datos todavía.</p>}
        {stats && stats.lostReasons.length > 0 && <><h3 className="adm-subhead">Motivos de pérdida</h3><ul className="adm-plain-list">{stats.lostReasons.map((row) => <li key={row.reason}><span>{row.reason}</span><strong>{row.total}</strong></li>)}</ul></>}
      </article>
    </section>

    <section className="panel adm-section">
      <div className="panel-header"><div><h2>Captación por redes</h2><p className="adm-muted">Publica estos enlaces: quien llena el formulario entra al CRM con el canal y la campaña. Las conversaciones directas regístralas con “+ Nuevo contacto” en el CRM.</p></div></div>
      <div className="sales-channel-links">{campaignChannels.map((channel) => <div className="sales-channel" key={channel}>
        <a href={`${campaign}${channel}`} target="_blank" rel="noopener noreferrer">{channel}<ArrowUpRight size={14} /></a>
        <button type="button" onClick={() => { void navigator.clipboard.writeText(`${window.location.origin}${campaign}${channel}`).then(() => toast.success(`Enlace de ${channel} copiado.`), () => toast.error("No se pudo copiar el enlace.")); }}>Copiar</button>
      </div>)}</div>
    </section>

    <ProspectingMode open={prospecting} asesor={asesor} owner={owner || undefined} onClose={() => { setProspecting(false); reload(); }} onOpenLead={setOpenLead} />
    <LeadDrawer leadId={openLead} asesor={asesor} onClose={() => setOpenLead(null)} onChanged={reload} />
  </>;
}
