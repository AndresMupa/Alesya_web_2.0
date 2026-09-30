"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarClock, RefreshCw, School } from "lucide-react";
import { toast } from "sonner";
import { Metric, PageHeader, useJson } from "@/components/admin/kit";
import { LeadDrawer } from "@/components/admin/crm/lead-drawer";
import { PipelineBoard, type PipelineCard, type PipelineColumn } from "@/components/admin/crm/pipeline-board";
import { campaignChannels, leadStageLabel } from "@/lib/crm/constants";
import { bogotaDay, formatDay, formatMoney, formatMoneyCompact, plural } from "@/lib/format";

type Metrics = { pipeline: { open: number; valueInCents: number }; wonThisMonth: { total: number; valueInCents: number }; lostThisMonth: number; winRate: number | null; dueFollowUps: number; inboundNew: number; prospectsUntouched: number; touchesThisWeek: number };
type AgendaItem = PipelineCard & { notes: string };
type Pipeline = { columns: PipelineColumn[]; prospects: number; metrics: Metrics; agenda: AgendaItem[]; queue: PipelineCard[] };

const campaign = "/colegios?utm_campaign=colegios_2026&utm_source=";

/**
 * Máquina de ventas: métricas del embudo, agenda de seguimientos, cola de prospección de la base de
 * colegios y tablero por etapas. Toda gestión se registra desde la ficha del contacto.
 */
export function SalesMachine() {
  const [revision, setRevision] = useState(0);
  const [openLead, setOpenLead] = useState<string | null>(null);
  const { data, error, loading } = useJson<Pipeline>("/api/admin/crm/pipeline", revision);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const today = bogotaDay();
  const metrics = data?.metrics;

  return <>
    <PageHeader title="Máquina de ventas" description="Prospecta la base de colegios, atiende los contactos entrantes, da seguimiento y cierra.">
      <Link className="refresh-button" href="/admin/crm">Ver base completa</Link>
      <button className="refresh-button" onClick={reload} disabled={loading}><RefreshCw size={15} /> {loading ? "Cargando…" : "Actualizar"}</button>
    </PageHeader>
    {error && <p className="checkout-status">{error}</p>}

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
          return <li key={item.id} data-state={state}><button type="button" onClick={() => setOpenLead(item.id)}>
            <time>{state === "overdue" ? "Vencido · " : state === "today" ? "Hoy · " : ""}{formatDay(item.nextFollowUp)}</time>
            <strong>{item.organization}</strong>
            <span>{leadStageLabel(item.stage)}{item.owner && ` · ${item.owner}`}{item.estimatedValueInCents > 0 && ` · ${formatMoney(item.estimatedValueInCents)}`}</span>
            {item.notes && <small>{item.notes.slice(0, 120)}</small>}
          </button></li>;
        })}</ul> : <p className="adm-muted">{loading ? "Cargando…" : "No hay seguimientos programados. Programa el siguiente paso al registrar cada gestión."}</p>}
      </article>
      <article className="panel">
        <div className="panel-header"><h2><School size={17} /> Cola de prospección</h2><span>{data ? `${data.prospects.toLocaleString("es-CO")} en la base` : ""}</span></div>
        {data?.queue.length ? <ul className="adm-queue">{data.queue.map((item) => <li key={item.id}>
          <div><strong>{item.organization}</strong><span>{item.city ?? "Ciudad sin registrar"}{item.phone ? ` · ${item.phone.split(";")[0]}` : ""}</span></div>
          <button type="button" className="refresh-button" onClick={() => setOpenLead(item.id)}>Gestionar</button>
        </li>)}</ul> : <p className="adm-muted">{loading ? "Cargando…" : "No quedan colegios sin contactar en la base."}</p>}
        <p className="adm-hint">Orden: prioridad alta primero. Al registrar la primera llamada o WhatsApp el colegio pasa a “Contactado” y sale de la cola.</p>
      </article>
    </section>

    <section className="panel adm-section">
      <div className="panel-header"><div><h2>Embudo por etapas</h2><p className="adm-muted">Arrastra una tarjeta para cambiar su etapa. Clic para abrir la ficha.</p></div></div>
      {data ? <PipelineBoard columns={data.columns} onOpen={setOpenLead} onMoved={reload} /> : <p className="adm-muted">{loading ? "Cargando embudo…" : ""}</p>}
    </section>

    <section className="panel adm-section">
      <div className="panel-header"><div><h2>Captación por redes</h2><p className="adm-muted">Publica estos enlaces: quien llena el formulario entra al CRM con el canal y la campaña. Las conversaciones directas regístralas con “+ Nuevo contacto” en el CRM.</p></div></div>
      <div className="sales-channel-links">{campaignChannels.map((channel) => <div className="sales-channel" key={channel}>
        <a href={`${campaign}${channel}`} target="_blank" rel="noopener noreferrer">{channel}<ArrowUpRight size={14} /></a>
        <button type="button" onClick={() => { void navigator.clipboard.writeText(`${window.location.origin}${campaign}${channel}`).then(() => toast.success(`Enlace de ${channel} copiado.`), () => toast.error("No se pudo copiar el enlace.")); }}>Copiar</button>
      </div>)}</div>
    </section>

    <LeadDrawer leadId={openLead} onClose={() => setOpenLead(null)} onChanged={reload} />
  </>;
}
