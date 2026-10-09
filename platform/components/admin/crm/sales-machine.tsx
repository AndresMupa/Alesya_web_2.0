"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, BarChart3, CalendarClock, FileText, Flag, Kanban, Megaphone, MessageCircle, Play, RefreshCw, School, Users } from "lucide-react";
import { toast } from "sonner";
import { AnalyticsPanel } from "@/components/admin/crm/analytics-panel";
import { InboxPanel, syncSummary } from "@/components/admin/crm/inbox-panel";
import { ColumnChart } from "@/components/admin/charts";
import { Metric, PageHeader, useJson } from "@/components/admin/kit";
import { AsesorPicker, useAsesor } from "@/components/admin/asesor";
import { LeadDrawer } from "@/components/admin/crm/lead-drawer";
import { PipelineBoard, type PipelineCard, type PipelineColumn } from "@/components/admin/crm/pipeline-board";
import { ProspectingMode } from "@/components/admin/crm/prospecting-mode";
import { QuotesList } from "@/components/admin/crm/quotes-list";
import { campaignChannels, leadStageLabel } from "@/lib/crm/constants";
import { scoreGrade } from "@/lib/crm/score";
import { bogotaDay, formatDay, formatMoney, formatMoneyCompact, plural, whatsappLink } from "@/lib/format";

type Metrics = { pipeline: { open: number; valueInCents: number }; wonThisMonth: { total: number; valueInCents: number }; lostThisMonth: number; winRate: number | null; dueFollowUps: number; inboundNew: number; prospectsUntouched: number; touchesThisWeek: number; touchesToday: number };
type AgendaItem = PipelineCard & { notes: string };
type Pipeline = { columns: PipelineColumn[]; prospects: number; metrics: Metrics; agenda: AgendaItem[]; noNextAction: PipelineCard[]; queue: PipelineCard[]; queueTotal: number; owners: string[]; cities: string[]; dailyGoal: number };
type Stats = { activityByDay: { day: string; total: number }[] };

const tabs = [
  { value: "tablero", label: "Tablero", icon: Kanban },
  { value: "agenda", label: "Agenda", icon: CalendarClock },
  { value: "cotizaciones", label: "Cotizaciones", icon: FileText },
  { value: "analitica", label: "Analítica", icon: BarChart3 },
  { value: "captacion", label: "Captación", icon: Megaphone },
] as const;
type Tab = (typeof tabs)[number]["value"];

const campaign = "/colegios?utm_campaign=colegios_2026&utm_source=";
const shortDate = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short" });
const dayLabel = (day: string) => shortDate.format(new Date(`${day}T05:00:00Z`));
// La pestaña vive en la URL (?tab=). Se lee como almacén externo para que servidor y cliente coincidan al hidratar.
const tabListeners = new Set<() => void>();
const readTab = (): Tab => { const value = new URLSearchParams(window.location.search).get("tab"); return tabs.some((tab) => tab.value === value) ? (value as Tab) : "tablero"; };
const subscribeTab = (listener: () => void) => { tabListeners.add(listener); window.addEventListener("popstate", listener); return () => { tabListeners.delete(listener); window.removeEventListener("popstate", listener); }; };
function useUrlTab(): [Tab, (next: Tab) => void] {
  const tab = useSyncExternalStore(subscribeTab, readTab, () => "tablero" as Tab);
  const setTab = (next: Tab) => { const url = new URL(window.location.href); if (next === "tablero") url.searchParams.delete("tab"); else url.searchParams.set("tab", next); window.history.replaceState(null, "", url.toString()); tabListeners.forEach((listener) => listener()); };
  return [tab, setTab];
}

// Al abrir la máquina de ventas se revisa el buzón comercial si la última revisión tiene más de 5 minutos (una vez por carga).
let inboxChecked = false;
function useInboxAutoSync(onNews: () => void) {
  useEffect(() => {
    if (inboxChecked) return;
    inboxChecked = true;
    fetch("/api/admin/crm/inbox", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ifStale: true }) })
      .then((response) => response.ok ? response.json() as Promise<{ created: number; matched: number; fresh?: boolean }> : null)
      .then((result) => {
        const summary = result && !result.fresh ? syncSummary(result) : "";
        if (summary) { toast.success(`Llegaron por correo: ${summary}.`); onNews(); }
      }, () => undefined);
  }, [onNews]);
}

/**
 * Máquina de ventas en pestañas: tablero del día (meta, agenda corta, cola, embudo), agenda completa con
 * oportunidades sin siguiente acción, cotizaciones, analítica comercial y captación por redes.
 */
export function SalesMachine() {
  const asesor = useAsesor();
  const [tab, setTab] = useUrlTab();
  const [scope, setScope] = useState("");
  const [queueCity, setQueueCity] = useState("");
  const [revision, setRevision] = useState(0);
  const [openLead, setOpenLead] = useState<string | null>(null);
  const [prospecting, setProspecting] = useState(false);
  const owner = scope === "mine" ? asesor : scope;
  const params = new URLSearchParams({ ...(owner && { owner }), ...(queueCity && { city: queueCity }) });
  const { data, error, loading } = useJson<Pipeline>(`/api/admin/crm/pipeline?${params}`, revision);
  const { data: stats } = useJson<Stats>(tab === "tablero" ? "/api/admin/crm/stats" : null, revision);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useInboxAutoSync(reload);
  const today = bogotaDay();
  const metrics = data?.metrics;

  return <>
    <PageHeader title="Máquina de ventas" description="Prospecta la base de colegios, atiende los contactos entrantes, cotiza, da seguimiento y cierra.">
      <AsesorPicker owners={data?.owners} />
      <button className="button button-primary adm-cta" onClick={() => setProspecting(true)}><Play size={15} /> Modo prospección</button>
      <Link className="refresh-button" href="/admin/crm">Ver base completa</Link>
      <button className="refresh-button" onClick={reload} disabled={loading}><RefreshCw size={15} /> {loading ? "Cargando…" : "Actualizar"}</button>
    </PageHeader>
    {error && <p className="checkout-status">{error}</p>}

    <div className="adm-subnav" role="tablist" aria-label="Secciones de la máquina de ventas">
      {tabs.map(({ value, label, icon: Icon }) => <button key={value} role="tab" aria-selected={tab === value} className={tab === value ? "is-active" : undefined} onClick={() => setTab(value)}><Icon size={15} /> {label}{value === "agenda" && metrics && metrics.dueFollowUps > 0 && <span>{metrics.dueFollowUps}</span>}</button>)}
      <label className="adm-scope-inline"><Users size={14} /><select className="admin-inline-input" value={scope} onChange={(event) => setScope(event.target.value)} aria-label="Asesor">
        <option value="">Todo el equipo</option>
        <option value="mine" disabled={!asesor}>{asesor ? `Mis oportunidades (${asesor})` : "Mis oportunidades (escribe tu nombre)"}</option>
        <option value="none">Sin asignar</option>
        {data?.owners.filter((item) => item !== asesor).map((item) => <option key={item} value={item}>{item}</option>)}
      </select></label>
    </div>

    {tab === "tablero" && <>
      {metrics && data && <section className="adm-today">
        <div>
          <p className="adm-today-label"><Flag size={14} /> Hoy</p>
          <h2>{metrics.touchesToday} de {data.dailyGoal} gestiones</h2>
          <div className="adm-progress" role="progressbar" aria-valuemin={0} aria-valuemax={data.dailyGoal} aria-valuenow={metrics.touchesToday}><i style={{ width: `${Math.min(100, Math.round((metrics.touchesToday / data.dailyGoal) * 100))}%` }} /></div>
          <p>{metrics.touchesToday >= data.dailyGoal ? "Meta del día cumplida. Lo que sigue es ganancia." : `Faltan ${data.dailyGoal - metrics.touchesToday} para la meta diaria${metrics.dueFollowUps ? ` · ${metrics.dueFollowUps} seguimientos por atender` : ""}${metrics.inboundNew ? ` · ${metrics.inboundNew} entrantes esperan respuesta` : ""}${data.noNextAction.length ? ` · ${data.noNextAction.length} sin siguiente acción` : ""}.`}</p>
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
          <div className="panel-header"><h2><CalendarClock size={17} /> Agenda de hoy</h2><button type="button" className="adm-more" onClick={() => setTab("agenda")}>Ver toda la agenda →</button></div>
          <AgendaList items={(data?.agenda ?? []).filter((item) => item.nextFollowUp! <= today).slice(0, 8)} today={today} onOpen={setOpenLead} empty={loading ? "Cargando…" : "Nada vencido ni para hoy. Revisa la agenda de la semana o prospecta."} />
        </article>
        <article className="panel">
          <div className="panel-header"><h2><School size={17} /> Cola de prospección</h2><select className="admin-inline-input" value={queueCity} onChange={(event) => setQueueCity(event.target.value)} aria-label="Ciudad de la cola"><option value="">Todas las ciudades</option>{data?.cities.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
          {data?.queue.length ? <ul className="adm-queue">{data.queue.map((item) => <li key={item.id}>
            <div><strong>{item.organization}</strong><span>{item.city ?? "Ciudad sin registrar"}{item.phone ? ` · ${item.phone.split(";")[0]}` : ""}</span></div>
            <button type="button" className="refresh-button" onClick={() => setOpenLead(item.id)}>Ficha</button>
          </li>)}</ul> : <p className="adm-muted">{loading ? "Cargando…" : "No quedan colegios sin contactar con estos filtros."}</p>}
          <div className="adm-queue-foot"><span className="adm-muted">{data ? `${data.queueTotal.toLocaleString("es-CO")} en cola` : ""}</span><button type="button" className="button button-dark" onClick={() => setProspecting(true)}><Play size={14} /> Empezar a prospectar</button></div>
        </article>
      </section>

      <section className="panel adm-section">
        <div className="panel-header"><div><h2>Embudo por etapas</h2><p className="adm-muted">Arrastra una tarjeta para cambiar su etapa. La letra es el puntaje (A prioridad); el ámbar marca más de 14 días sin avanzar.</p></div></div>
        {data ? <PipelineBoard columns={data.columns} onOpen={setOpenLead} onMoved={reload} /> : <p className="adm-muted">{loading ? "Cargando embudo…" : ""}</p>}
      </section>

      <section className="panel adm-section">
        <div className="panel-header"><div><h2>Gestiones por día</h2><p className="adm-muted">Últimos 14 días. Las columnas que alcanzan la meta diaria ({data?.dailyGoal ?? "—"}) se resaltan.</p></div></div>
        {stats ? <ColumnChart data={stats.activityByDay.map((row) => ({ dia: dayLabel(row.day), gestiones: row.total }))} x="dia" y="gestiones" unit="gestiones" goal={data?.dailyGoal} highlightLast={false} /> : <p className="adm-muted">{loading ? "Cargando…" : ""}</p>}
      </section>
    </>}

    {tab === "agenda" && data && <>
      <section className="adm-two-col">
        <article className="panel"><div className="panel-header"><h2>Vencidos</h2><span>{data.agenda.filter((item) => item.nextFollowUp! < today).length}</span></div><AgendaList items={data.agenda.filter((item) => item.nextFollowUp! < today)} today={today} onOpen={setOpenLead} empty="Nada vencido. Así se ve un equipo al día." /></article>
        <article className="panel"><div className="panel-header"><h2>Hoy</h2><span>{data.agenda.filter((item) => item.nextFollowUp === today).length}</span></div><AgendaList items={data.agenda.filter((item) => item.nextFollowUp === today)} today={today} onOpen={setOpenLead} empty="Sin seguimientos para hoy." /></article>
      </section>
      <section className="adm-two-col">
        <article className="panel"><div className="panel-header"><h2>Próximos 7 días</h2><span>{data.agenda.filter((item) => item.nextFollowUp! > today).length}</span></div><AgendaList items={data.agenda.filter((item) => item.nextFollowUp! > today)} today={today} onOpen={setOpenLead} empty="Sin seguimientos programados esta semana." /></article>
        <article className="panel"><div className="panel-header"><h2><AlertTriangle size={16} /> Sin siguiente acción</h2><span>{data.noNextAction.length}</span></div>
          <p className="adm-muted">Oportunidades abiertas sin fecha de seguimiento. El proceso exige una siguiente acción para cada una: ábrela y prográmala.</p>
          {data.noNextAction.length ? <ul className="adm-queue">{data.noNextAction.map((item) => <li key={item.id}><div><strong><b className="adm-score" data-grade={scoreGrade(item.score)}>{scoreGrade(item.score)}</b>{item.organization}</strong><span>{leadStageLabel(item.stage)}{item.owner && ` · ${item.owner}`}{item.estimatedValueInCents > 0 && ` · ${formatMoney(item.estimatedValueInCents)}`}</span></div><button type="button" className="refresh-button" onClick={() => setOpenLead(item.id)}>Programar</button></li>)}</ul> : <div className="adm-empty"><strong>Todas tienen siguiente acción</strong></div>}
        </article>
      </section>
    </>}

    {tab === "cotizaciones" && <QuotesList asesor={asesor} />}
    {tab === "analitica" && <AnalyticsPanel revision={revision} />}

    {tab === "captacion" && <InboxPanel onOpenLead={setOpenLead} onSynced={reload} />}
    {tab === "captacion" && <section className="panel adm-section">
      <div className="panel-header"><div><h2>Captación por redes</h2><p className="adm-muted">Publica estos enlaces: quien llena el formulario entra al CRM con el canal y la campaña, con prioridad alta y aviso al equipo. Las conversaciones directas regístralas con “+ Nuevo contacto” en el CRM.</p></div></div>
      <div className="sales-channel-links">{campaignChannels.map((channel) => <div className="sales-channel" key={channel}>
        <a href={`${campaign}${channel}`} target="_blank" rel="noopener noreferrer">{channel}<ArrowUpRight size={14} /></a>
        <button type="button" onClick={() => { void navigator.clipboard.writeText(`${window.location.origin}${campaign}${channel}`).then(() => toast.success(`Enlace de ${channel} copiado.`), () => toast.error("No se pudo copiar el enlace.")); }}>Copiar</button>
      </div>)}</div>
      <p className="adm-hint">Resumen diario por correo: programa en cPanel un cron que llame a <code>/api/cron/daily?token=…</code> cada mañana (ver documentación de despliegue). Envía a todo el equipo los seguimientos del día, entrantes sin atender, oportunidades sin siguiente acción y cotizaciones por vencer.</p>
    </section>}

    <ProspectingMode open={prospecting} asesor={asesor} owner={owner || undefined} onClose={() => { setProspecting(false); reload(); }} onOpenLead={setOpenLead} />
    <LeadDrawer leadId={openLead} asesor={asesor} onClose={() => setOpenLead(null)} onChanged={reload} />
  </>;
}

function AgendaList({ items, today, onOpen, empty }: { items: AgendaItem[]; today: string; onOpen: (id: string) => void; empty: string }) {
  if (!items.length) return <p className="adm-muted">{empty}</p>;
  return <ul className="adm-agenda">{items.map((item) => {
    const state = item.nextFollowUp! < today ? "overdue" : item.nextFollowUp === today ? "today" : "soon";
    const wa = whatsappLink(item.phone);
    return <li key={item.id} data-state={state}>
      <button type="button" onClick={() => onOpen(item.id)}>
        <time>{state === "overdue" ? "Vencido · " : state === "today" ? "Hoy · " : ""}{formatDay(item.nextFollowUp)}</time>
        <strong><b className="adm-score" data-grade={scoreGrade(item.score)}>{scoreGrade(item.score)}</b>{item.organization}</strong>
        <span>{item.nextAction ?? leadStageLabel(item.stage)}{item.owner && ` · ${item.owner}`}{item.estimatedValueInCents > 0 && ` · ${formatMoney(item.estimatedValueInCents)}`}</span>
        {item.notes && <small>{item.notes.slice(0, 120)}</small>}
      </button>
      {wa && <a className="adm-agenda-wa" href={wa} target="_blank" rel="noopener noreferrer" title="WhatsApp" aria-label={`WhatsApp a ${item.organization}`}><MessageCircle size={15} /></a>}
    </li>;
  })}</ul>;
}
