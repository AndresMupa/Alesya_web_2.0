import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowRight, CalendarClock } from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminSummary, type AdminSummary } from "@/lib/admin-summary";
import { leadStageLabel } from "@/lib/crm/constants";
import { bogotaDay, formatDay, formatMoneyCompact, plural } from "@/lib/format";
import { Metric, PageHeader } from "@/components/admin/kit";

export const metadata = { title: "Resumen" };

// Enlaces antiguos (/admin?vista=crm#gestion) siguen llevando al módulo correcto.
const legacyViews: Record<string, string> = { crm: "/admin/crm", pedidos: "/admin/pedidos", productos: "/admin/productos", ventas: "/admin/ventas" };

async function loadSummary(): Promise<AdminSummary | null> {
  try { return await getAdminSummary(); } catch (error) { console.error("admin_summary_failed", error); return null; }
}

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  await requireAdmin();
  const { vista } = await searchParams;
  if (vista && legacyViews[vista]) redirect(legacyViews[vista]);
  const summary = await loadSummary();
  if (!summary) return <p className="checkout-status">No fue posible calcular el resumen. Revisa la conexión de la base de datos.</p>;
  const funnelMax = Math.max(1, ...summary.funnel.map(([, value]) => value));
  const today = bogotaDay();
  const { crm } = summary;

  return <>
    <PageHeader title="Resumen" description="Ventas, embudo comercial, pedidos e inventario de un vistazo." />
    <section className="admin-summary">
      <Metric label="Ventas del mes" value={formatMoneyCompact(summary.sales.totalInCents)} hint={summary.sales.changePct === null ? plural(summary.sales.orders, "pedido pagado", "pedidos pagados") : `${summary.sales.changePct >= 0 ? "↑" : "↓"} ${Math.abs(summary.sales.changePct).toFixed(1).replace(".", ",")}% frente al mes anterior`} />
      <Metric label="Embudo abierto" value={formatMoneyCompact(crm.pipeline.valueInCents)} hint={`${plural(crm.pipeline.open, "oportunidad", "oportunidades")} · ${crm.inboundNew} entrantes sin atender`} tone={crm.inboundNew ? "warning" : undefined} />
      <Metric label="Pedidos por preparar" value={summary.orders.toPrepare} hint={`${summary.orders.awaitingPayment} esperando pago${summary.orders.inReview ? ` · ${summary.orders.inReview} en revisión` : ""}`} tone={summary.orders.inReview ? "warning" : undefined} />
      <Metric label="Productos publicados" value={summary.products.active} hint={summary.products.noPrice ? `${summary.products.noPrice} sin precio · ${summary.products.lowStock} con stock bajo` : `${summary.products.lowStock} con stock bajo`} tone={summary.products.noPrice || summary.products.lowStock ? "warning" : undefined} />
    </section>

    <section className="admin-grid">
      <article className="panel">
        <div className="panel-header"><h2>Embudo comercial</h2><Link href="/admin/ventas" className="adm-more">Máquina de ventas <ArrowRight size={14} /></Link></div>
        <div className="pipeline">{summary.funnel.map(([label, value]) => <div className="pipeline-col" key={label}><b>{value.toLocaleString("es-CO")}</b><div className="pipeline-bar" style={{ height: `${Math.max(8, Math.round((value / funnelMax) * 130))}px` }} /><small>{label}</small></div>)}</div>
        <p className="adm-muted adm-small">Ganado este mes: {formatMoneyCompact(crm.wonThisMonth.valueInCents)} ({crm.wonThisMonth.total}) · tasa de cierre {crm.winRate === null ? "—" : `${crm.winRate}%`} · {crm.touchesThisWeek} gestiones en 7 días</p>
      </article>
      <article className="panel">
        <div className="panel-header"><h2><CalendarClock size={16} /> Seguimientos</h2><span>{plural(crm.dueFollowUps, "vencido u hoy", "vencidos u hoy")}</span></div>
        {summary.agenda.length ? <ul className="adm-agenda adm-agenda-compact">{summary.agenda.map((item) => <li key={item.id} data-state={item.nextFollowUp! < today ? "overdue" : item.nextFollowUp === today ? "today" : "soon"}>
          <Link href={`/admin/crm?lead=${item.id}`}><time>{formatDay(item.nextFollowUp)}</time><strong>{item.organization}</strong><span>{leadStageLabel(item.stage)}{item.owner && ` · ${item.owner}`}</span></Link>
        </li>)}</ul> : <p className="adm-muted">Sin seguimientos en los próximos 7 días.</p>}
      </article>
    </section>

    <section className="admin-grid">
      <article className="panel">
        <div className="panel-header"><h2>Actividad reciente</h2><span>Contactos entrantes y pedidos</span></div>
        <div className="activity-list">{summary.activity.length ? summary.activity.map((item, index) => <Link className="activity-item" href={item.href} key={index}><i className="activity-dot" data-kind={item.kind} /><span>{item.label}</span><small>{formatDistanceToNow(item.at, { locale: es })}</small></Link>) : <p>Todavía no hay actividad. Los contactos del sitio y los pedidos aparecerán aquí.</p>}</div>
      </article>
      <article className="panel">
        <div className="panel-header"><h2>Stock bajo</h2><Link href="/admin/productos" className="adm-more">Inventario <ArrowRight size={14} /></Link></div>
        {summary.products.lowStockItems.length ? <ul className="adm-plain-list">{summary.products.lowStockItems.map((product) => <li key={product.id}><span>{product.name}<small>{product.sku}</small></span><strong className={product.stock <= 0 ? "is-negative" : undefined}>{product.stock} und</strong></li>)}</ul> : <p className="adm-muted">Ningún producto publicado está por debajo de 5 unidades.</p>}
      </article>
    </section>
  </>;
}
