import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowRight, CalendarClock, PackageOpen, TrendingUp } from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminSummary, type AdminSummary } from "@/lib/admin-summary";
import { getCommerceStats, type CommerceStats } from "@/lib/commerce/stats";
import { getTeamStats } from "@/lib/crm/leads";
import { leadStageLabel } from "@/lib/crm/constants";
import { bogotaDay, formatDay, formatMoney, formatMoneyCompact, plural } from "@/lib/format";
import { ColumnChart, HBarChart } from "@/components/admin/charts";
import { Metric, PageHeader } from "@/components/admin/kit";

export const metadata = { title: "Resumen" };

// Enlaces antiguos (/admin?vista=crm#gestion) siguen llevando al módulo correcto.
const legacyViews: Record<string, string> = { crm: "/admin/crm", pedidos: "/admin/pedidos", productos: "/admin/productos", ventas: "/admin/ventas" };
const shortDate = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short" });
const weekLabel = (week: string) => shortDate.format(new Date(`${week}T05:00:00Z`));
const dayLabel = (day: string) => shortDate.format(new Date(`${day}T05:00:00Z`));

type Team = Awaited<ReturnType<typeof getTeamStats>>;

async function load(): Promise<{ summary: AdminSummary | null; commerce: CommerceStats | null; team: Team | null }> {
  const [summary, commerce, team] = await Promise.all([
    getAdminSummary().catch((error) => { console.error("admin_summary_failed", error); return null; }),
    getCommerceStats().catch((error) => { console.error("commerce_stats_failed", error); return null; }),
    getTeamStats().catch((error) => { console.error("team_stats_failed", error); return null; }),
  ]);
  return { summary, commerce, team };
}

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  await requireAdmin();
  const { vista } = await searchParams;
  if (vista && legacyViews[vista]) redirect(legacyViews[vista]);
  const { summary, commerce, team } = await load();
  if (!summary) return <p className="checkout-status">No fue posible calcular el resumen. Revisa la conexión de la base de datos.</p>;
  const today = bogotaDay();
  const { crm } = summary;

  return <>
    <PageHeader title="Resumen" description="Ventas, embudo comercial, pedidos e inventario de un vistazo." />
    <section className="admin-summary">
      <Metric label="Ventas del mes" value={formatMoneyCompact(summary.sales.totalInCents)} hint={summary.sales.changePct === null ? plural(summary.sales.orders, "pedido pagado", "pedidos pagados") : `${summary.sales.changePct >= 0 ? "↑" : "↓"} ${Math.abs(summary.sales.changePct).toFixed(1).replace(".", ",")}% frente al mes anterior`} tone={summary.sales.changePct !== null && summary.sales.changePct < 0 ? "warning" : "good"} />
      <Metric label="Embudo abierto" value={formatMoneyCompact(crm.pipeline.valueInCents)} hint={`${plural(crm.pipeline.open, "oportunidad", "oportunidades")} · ${crm.inboundNew} entrantes sin atender`} tone={crm.inboundNew ? "warning" : undefined} />
      <Metric label="Pedidos por preparar" value={summary.orders.toPrepare} hint={`${summary.orders.awaitingPayment} esperando pago${summary.orders.inReview ? ` · ${summary.orders.inReview} en revisión` : ""}`} tone={summary.orders.inReview ? "warning" : undefined} />
      <Metric label="Productos publicados" value={summary.products.active} hint={summary.products.noPrice ? `${summary.products.noPrice} sin precio · ${summary.products.lowStock} con stock bajo` : `${summary.products.lowStock} con stock bajo`} tone={summary.products.noPrice || summary.products.lowStock ? "warning" : undefined} />
    </section>

    <section className="admin-grid">
      <article className="panel">
        <div className="panel-header"><h2><TrendingUp size={16} /> Ventas por semana</h2><Link href="/admin/pedidos" className="adm-more">Pedidos <ArrowRight size={14} /></Link></div>
        {commerce ? <ColumnChart data={commerce.revenueByWeek.map((row) => ({ semana: weekLabel(row.week), ventas: row.revenueInCents, pedidos: row.orders }))} x="semana" y="ventas" money /> : <p className="adm-muted">Sin datos de ventas.</p>}
        <p className="adm-muted adm-small">Pedidos pagados por semana (lunes a domingo). La última columna es la semana en curso.</p>
      </article>
      <article className="panel">
        <div className="panel-header"><h2>Embudo comercial</h2><Link href="/admin/ventas" className="adm-more">Máquina de ventas <ArrowRight size={14} /></Link></div>
        <HBarChart data={summary.funnel.map(([label, value]) => ({ etapa: label, contactos: value }))} x="etapa" y="contactos" labelWidth={90} />
        <p className="adm-muted adm-small">Ganado este mes: {formatMoneyCompact(crm.wonThisMonth.valueInCents)} ({crm.wonThisMonth.total}) · cierre {crm.winRate === null ? "—" : `${crm.winRate}%`}</p>
      </article>
    </section>

    <section className="admin-grid">
      <article className="panel">
        <div className="panel-header"><h2>Gestiones comerciales por día</h2><span>Últimos 14 días · {plural(crm.touchesThisWeek, "en la última semana", "en la última semana")}</span></div>
        {team ? <ColumnChart data={team.activityByDay.map((row) => ({ dia: dayLabel(row.day), gestiones: row.total }))} x="dia" y="gestiones" unit="gestiones" /> : <p className="adm-muted">Sin datos.</p>}
      </article>
      <article className="panel">
        <div className="panel-header"><h2><PackageOpen size={16} /> Más vendidos</h2><span>Últimos 30 días</span></div>
        {commerce?.topProducts.length ? <HBarChart data={commerce.topProducts.map((row) => ({ producto: row.name.length > 26 ? `${row.name.slice(0, 25)}…` : row.name, ventas: row.revenueInCents }))} x="producto" y="ventas" money labelWidth={170} /> : <div className="adm-empty"><PackageOpen size={26} strokeWidth={1.3} /><strong>Aún no hay ventas pagadas este mes</strong><span>Los productos más vendidos aparecerán aquí.</span></div>}
      </article>
    </section>

    <section className="admin-grid">
      <article className="panel">
        <div className="panel-header"><h2>Actividad reciente</h2><span>Contactos entrantes y pedidos</span></div>
        <div className="activity-list">{summary.activity.length ? summary.activity.map((item, index) => <Link className="activity-item" href={item.href} key={index}><i className="activity-dot" data-kind={item.kind} /><span>{item.label}</span><small>{formatDistanceToNow(item.at, { locale: es })}</small></Link>) : <div className="adm-empty"><strong>Todavía no hay actividad</strong><span>Los contactos del sitio y los pedidos aparecerán aquí.</span></div>}</div>
      </article>
      <article className="panel">
        <div className="panel-header"><h2><CalendarClock size={16} /> Seguimientos</h2><span>{plural(crm.dueFollowUps, "vencido u hoy", "vencidos u hoy")}</span></div>
        {summary.agenda.length ? <ul className="adm-agenda adm-agenda-compact">{summary.agenda.map((item) => <li key={item.id} data-state={item.nextFollowUp! < today ? "overdue" : item.nextFollowUp === today ? "today" : "soon"}>
          <Link href={`/admin/crm?lead=${item.id}`}><time>{formatDay(item.nextFollowUp)}</time><strong>{item.organization}</strong><span>{leadStageLabel(item.stage)}{item.owner && ` · ${item.owner}`}</span></Link>
        </li>)}</ul> : <div className="adm-empty"><strong>Sin seguimientos en 7 días</strong><span>Programa el siguiente paso al registrar cada gestión.</span></div>}
        {summary.products.lowStockItems.length > 0 && <><h3 className="adm-subhead">Stock bajo</h3><ul className="adm-plain-list">{summary.products.lowStockItems.map((product) => <li key={product.id}><span>{product.name}<small>{product.sku}</small></span><strong className={product.stock <= 0 ? "is-negative" : undefined}>{product.stock} und</strong></li>)}</ul></>}
      </article>
    </section>
    {commerce && commerce.byStatus.length > 0 && <p className="adm-muted adm-small">Pedidos: {commerce.byStatus.map((row) => `${row.total} ${row.status.replace(/_/g, " ")} (${formatMoney(row.valueInCents)})`).join(" · ")}</p>}
  </>;
}
