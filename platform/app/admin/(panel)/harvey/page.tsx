import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Activity, ArrowRight, Bot, KeyRound, MailCheck, MessageSquareReply, RefreshCw, Send } from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import { getHarveyOverview, type HarveyEventKind, type HarveyOverview } from "@/lib/crm/harvey";
import { leadStageLabel, leadStages } from "@/lib/crm/constants";
import { formatDay, plural } from "@/lib/format";
import { AutoRefresh } from "@/components/admin/auto-refresh";
import { HBarChart } from "@/components/admin/charts";
import { Metric, PageHeader } from "@/components/admin/kit";

export const metadata = { title: "Harvey" };

/** La sincronización corre cada 5 minutos en el equipo del asesor; más de 20 sin noticias es que el equipo está apagado o algo falló. */
const SYNC_STALE_MS = 20 * 60_000;
const CYCLE_STALE_MS = 60 * 60_000;

const kindLabels: Record<HarveyEventKind, string> = {
  enqueued: "Entregado", skipped: "Descartado", sent: "Correo enviado", reply: "Respuesta", meeting: "Reunión",
  optout: "Baja", bounce: "Rebote", invalid_email: "Correo inválido", email_found: "Correo encontrado", email_not_found: "Sin correo publicado",
};

const ago = (value: string | number | Date) => formatDistanceToNow(new Date(value), { locale: es, addSuffix: true });
const isStale = (value: string | null | undefined, limit: number) => !value || Date.now() - new Date(value).getTime() > limit;
const leadHref = (id: string) => `/admin/crm?lead=${encodeURIComponent(id)}`;

function Status({ data }: { data: HarveyOverview }) {
  const { sync, configured } = data;
  const snapshot = sync?.snapshot;
  const syncStale = isStale(sync?.lastRequestAt, SYNC_STALE_MS);
  const cycleStale = isStale(snapshot?.lastCycleAt, CYCLE_STALE_MS);
  const items = [
    {
      icon: KeyRound, name: "Conexión con el CRM",
      detail: configured ? "HARVEY_SYNC_TOKEN configurado: Harvey puede pedir colegios y reportar lo que pasa con cada uno." : "Falta HARVEY_SYNC_TOKEN en cPanel → Setup Node.js App (24+ caracteres, el mismo CRM_SYNC_TOKEN del .env de Harvey).",
      state: configured ? "Activa" : "Configurar", ok: configured,
    },
    {
      icon: RefreshCw, name: "Sincronización programada",
      detail: sync ? `Última llamada ${ago(sync.lastRequestAt)}. Corre cada 5 minutos mientras el equipo del asesor esté encendido.` : "Harvey todavía no se ha comunicado con el CRM.",
      state: !sync ? "Sin datos" : syncStale ? "Retrasada" : "Al día", ok: Boolean(sync) && !syncStale,
    },
    {
      icon: Activity, name: "Ciclo de Harvey",
      detail: !snapshot ? "Sin resumen todavía: llega con la próxima sincronización." : snapshot.lastCycleAt ? `Su última acción fue ${ago(snapshot.lastCycleAt)}. Mientras el ciclo esté detenido no redacta, no envía ni lee respuestas.` : "Harvey no ha registrado acciones.",
      state: !snapshot ? "Sin datos" : cycleStale ? "Detenido" : "Trabajando", ok: Boolean(snapshot) && !cycleStale,
    },
    {
      icon: Send, name: "Envíos",
      detail: !snapshot ? "Sin resumen todavía." : snapshot.sendingPaused ? "Pausados en Harvey: no sale ningún correo hasta reanudarlos." : snapshot.outboxPending ? `${plural(snapshot.outboxPending, "correo espera", "correos esperan")} tu aprobación en el Outbox de Harvey. Nada sale sin aprobar.` : "Nada pendiente de aprobación en el Outbox de Harvey.",
      state: !snapshot ? "Sin datos" : snapshot.sendingPaused ? "Pausados" : snapshot.outboxPending ? "Por aprobar" : "Al día", ok: !!snapshot && !snapshot.sendingPaused && !snapshot.outboxPending,
    },
  ];
  return <section className="panel adm-section">
    <div className="panel-header"><h2><Bot size={16} /> Estado</h2>{snapshot && <span>Resumen de Harvey {ago(snapshot.at)}</span>}</div>
    <ul className="adm-integrations">{items.map(({ icon: Icon, name, detail, state, ok }) => <li key={name}><Icon /><div><strong>{name}</strong><p>{detail}</p></div><span className={`status-pill${ok ? "" : " pending"}`}>{state}</span></li>)}</ul>
  </section>;
}

export default async function HarveyPage() {
  await requireAdmin();
  const data = await getHarveyOverview().catch((error) => { console.error("harvey_overview_failed", error); return null; });
  if (!data) return <p className="checkout-status">No fue posible cargar el estado de Harvey. Revisa la conexión de la base de datos.</p>;
  const { counts, pending, stages, recent, toAttend } = data;
  const snapshot = data.sync?.snapshot;
  const stageOrder = leadStages.map((stage) => stage.value as string);
  const funnel = [...stages].sort((a, b) => stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage)).map((row) => ({ etapa: leadStageLabel(row.stage), colegios: row.total }));

  return <>
    <AutoRefresh seconds={60} />
    <PageHeader title="Harvey" description="El agente de prospección por correo: qué colegios tiene, qué ha enviado y quién respondió. Se actualiza solo cada minuto." />
    <Status data={data} />

    <section className="panel adm-section">
      <div className="panel-header"><h2><Activity size={16} /> En vivo: lo último que hizo Harvey</h2>{snapshot && <span>Reportado {ago(snapshot.at)}</span>}</div>
      {snapshot?.recent?.length ? <div className="activity-list">{snapshot.recent.map((row, index) => <div className="activity-item" key={`${row.at}-${index}`}><i className="activity-dot" /><span>{row.text}</span><small>{ago(row.at)}</small></div>)}</div>
        : <p className="adm-muted">Las acciones de Harvey (buscar correos, redactar, enviar, leer respuestas) aparecen aquí con cada sincronización.</p>}
    </section>

    <section className="admin-summary">
      <Metric label="Colegios en Harvey" value={counts.enqueued.toLocaleString("es-CO")} hint={snapshot ? `${snapshot.verified} con correo verificado · ${snapshot.pendingVerification} por verificar` : `${plural(counts.skipped, "descartado", "descartados")} por correo personal`} />
      <Metric label="Correos enviados" value={counts.sent.toLocaleString("es-CO")} hint={snapshot?.outboxPending ? `${plural(snapshot.outboxPending, "espera", "esperan")} aprobación` : "Cada envío pasa por aprobación"} tone={snapshot?.outboxPending ? "warning" : undefined} />
      <Metric label="Respuestas" value={counts.reply.toLocaleString("es-CO")} hint={`${plural(counts.meeting, "reunión", "reuniones")} · ${toAttend.length} por atender`} tone={toAttend.length ? "warning" : counts.reply ? "good" : undefined} />
      <Metric label="Bajas y rebotes" value={(counts.optout + counts.bounce + counts.invalid_email).toLocaleString("es-CO")} hint={`${plural(counts.optout, "baja", "bajas")} · ${counts.bounce + counts.invalid_email} correos malos`} />
    </section>

    <section className="admin-grid">
      <article className="panel">
        <div className="panel-header"><h2><MessageSquareReply size={16} /> Respuestas por atender</h2><Link href="/admin/ventas" className="adm-more">Máquina de ventas <ArrowRight size={14} /></Link></div>
        <div className="activity-list">{toAttend.length ? toAttend.map((row) => <Link className="activity-item" href={leadHref(row.leadId)} key={row.leadId}><i className="activity-dot" data-kind="reply" /><span><strong>{row.organization}</strong>{row.city ? ` · ${row.city}` : ""}<br />{row.nextAction ?? "Revisar la respuesta"}</span><small>{formatDay(row.nextFollowUp)}</small></Link>) : <div className="adm-empty"><MailCheck size={26} strokeWidth={1.3} /><strong>Nadie esperando respuesta</strong><span>Cuando un colegio le conteste a Harvey aparecerá aquí, con la siguiente acción.</span></div>}</div>
      </article>
      <article className="panel">
        <div className="panel-header"><h2>Por entregar a Harvey</h2><span>{plural(pending.total, "colegio", "colegios")}</span></div>
        {pending.byCity.length ? <HBarChart data={pending.byCity.slice(0, 8).map((row) => ({ ciudad: row.city, colegios: row.total }))} x="ciudad" y="colegios" unit="colegios" labelWidth={110} /> : <p className="adm-muted">No quedan colegios nuevos con correo por entregar.</p>}
        <p className="adm-muted adm-small">Etapa Nuevo, con correo y sin baja. Harvey toma hasta 20 por día de las ciudades y bases configuradas en su .env (CRM_SYNC_CITIES y CRM_SYNC_SOURCES).{pending.missingEmail ? ` Otros ${plural(pending.missingEmail, "colegio de la base de prospección no tiene", "colegios de la base de prospección no tienen")} correo: Harvey lo busca en su sitio web.` : ""}</p>
      </article>
    </section>

    <section className="admin-grid">
      <article className="panel">
        <div className="panel-header"><h2>Actividad reciente</h2><span>Envíos, respuestas, bajas y descartes</span></div>
        <div className="activity-list">{recent.length ? recent.map((row) => <Link className="activity-item" href={leadHref(row.leadId)} key={row.id}><i className="activity-dot" data-kind={row.kind} /><span><strong>{kindLabels[row.kind] ?? row.kind}</strong> · {row.organization}{row.city ? ` (${row.city})` : ""}<br /><small>{row.summary}</small></span><small>{ago(row.at)}</small></Link>) : <div className="adm-empty"><strong>Todavía no hay actividad</strong><span>Los envíos y respuestas de Harvey aparecerán aquí.</span></div>}</div>
      </article>
      <article className="panel">
        <div className="panel-header"><h2>Colegios de Harvey por etapa</h2><Link href="/admin/crm" className="adm-more">CRM <ArrowRight size={14} /></Link></div>
        {funnel.length ? <HBarChart data={funnel} x="etapa" y="colegios" unit="colegios" labelWidth={90} /> : <p className="adm-muted">Harvey aún no tiene colegios.</p>}
        <p className="adm-muted adm-small">Pasan solos a Contactado con el primer envío o respuesta, a Reunión cuando la piden y a Perdido si se dan de baja.</p>
      </article>
    </section>
  </>;
}
