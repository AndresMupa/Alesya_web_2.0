import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { ContactRound, TrendingUp, Database, LayoutDashboard, Package, PlugZap, ReceiptText, ShoppingCart, Store } from "lucide-react";
import { demoDatabase } from "@/db";
import { getAdmin } from "@/lib/admin-auth";
import { getAdminSummary, type AdminSummary } from "@/lib/admin-summary";
import { SalesWorkbench } from "@/components/sales-workbench";
import { AdminWorkbench, type WorkspaceTab } from "@/components/admin-workbench";
import { BrandLockup } from "@/components/brand-lockup";

export const dynamic = "force-dynamic";
export const metadata = { title: "Centro de operaciones | Alesya", robots: { index: false, follow: false } };

const nav = [
  [LayoutDashboard, "Resumen", "/admin#resumen"],
  [TrendingUp, "Ventas", "/admin#ventas"],
  [ContactRound, "CRM", "/admin?vista=crm#gestion"],
  [ShoppingCart, "Pedidos", "/admin?vista=pedidos#gestion"],
  [Package, "Productos", "/admin?vista=productos#gestion"],
  [PlugZap, "Integraciones", "/admin#integraciones"],
] as const;
const views: Record<string, WorkspaceTab> = { crm: "crm", pedidos: "orders", productos: "products" };
const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", notation: "compact", maximumFractionDigits: 1 });
const plural = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`;

async function loadSummary(): Promise<AdminSummary | null> {
  try { return await getAdminSummary(); } catch (error) { console.error("admin_summary_failed", error); return null; }
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  const [{ vista }, summary] = await Promise.all([searchParams, loadSummary()]);
  const tab = views[vista ?? ""] ?? "crm";
  const wompiReady = Boolean(process.env.WOMPI_PUBLIC_KEY && process.env.WOMPI_INTEGRITY_SECRET && process.env.WOMPI_EVENTS_SECRET);
  const wompiMode = process.env.WOMPI_PUBLIC_KEY?.startsWith("pub_prod_") ? "producción" : "sandbox";
  const demo = demoDatabase();
  const persistentDb = Boolean(process.env.TURSO_DATABASE_URL && !process.env.TURSO_DATABASE_URL.startsWith("file:"));
  const funnelMax = Math.max(1, ...(summary?.funnel.map(([, value]) => value) ?? []));

  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <BrandLockup operations />
      <nav className="admin-nav">{nav.map(([Icon, label, href]) => <Link href={href} key={label}><Icon />{label}</Link>)}</nav>
      <Link className="admin-back" href="/">← Volver al sitio</Link>
    </aside>
    <main className="admin-main">
      <header className="admin-topbar"><h1>Ventas y operaciones</h1><div className="admin-user"><span>{admin.email}</span><form action="/api/admin/logout" method="post"><button className="refresh-button">Cerrar sesión</button></form></div></header>
      <div className="admin-content">
        {demo && <p className="checkout-status admin-demo-banner"><strong>Entorno de pruebas.</strong> Todos los datos son ficticios. Los cambios que hagas pueden reiniciarse cuando Vercel recicle el servidor.</p>}
        {!summary && <p className="checkout-status">No fue posible calcular el resumen. Revisa la conexión de la base de datos.</p>}
        {summary && <>
          <section className="admin-summary" id="resumen">
            <article className="metric-card"><p>Ventas del mes</p><strong>{money.format(summary.sales.totalInCents / 100)}</strong><span>{summary.sales.changePct === null ? plural(summary.sales.orders, "pedido pagado", "pedidos pagados") : `${summary.sales.changePct >= 0 ? "↑" : "↓"} ${Math.abs(summary.sales.changePct).toFixed(1).replace(".", ",")}% frente al mes anterior`}</span></article>
            <article className="metric-card"><p>Oportunidades activas</p><strong>{summary.leads.active}</strong><span>{plural(summary.leads.unattended, "sin contactar", "sin contactar")}</span></article>
            <article className="metric-card"><p>Pedidos por preparar</p><strong>{summary.orders.toPrepare}</strong><span>{plural(summary.orders.awaitingPayment, "esperando pago", "esperando pago")}{summary.orders.inReview ? ` · ${summary.orders.inReview} en revisión` : ""}</span></article>
            <article className="metric-card"><p>Productos activos</p><strong>{summary.products.active}</strong><span className={summary.products.lowStock ? "metric-warning" : undefined}>{plural(summary.products.lowStock, "con stock bajo", "con stock bajo")}</span></article>
          </section>
          <section className="admin-grid">
            <article className="panel"><div className="panel-header"><h2>Embudo comercial</h2><span>Oportunidades por etapa</span></div><div className="pipeline">{summary.funnel.map(([label, value]) => <div className="pipeline-col" key={label}><b>{value}</b><div className="pipeline-bar" style={{ height: `${Math.max(8, Math.round((value / funnelMax) * 130))}px` }} /><small>{label}</small></div>)}</div></article>
            <article className="panel"><div className="panel-header"><h2>Actividad reciente</h2><span>Contactos y pedidos</span></div><div className="activity-list">{summary.activity.length ? summary.activity.map((item, index) => <div className="activity-item" key={index}><i className="activity-dot" data-kind={item.kind} /><span>{item.label}</span><small>{formatDistanceToNow(item.at, { locale: es })}</small></div>) : <p>Todavía no hay actividad. Los contactos del sitio y los pedidos aparecerán aquí.</p>}</div></article>
          </section>
        </>}
        <SalesWorkbench />
        <AdminWorkbench key={tab} initialTab={tab} />
        <section className="admin-grid" id="integraciones"><article className="panel"><div className="panel-header"><h2>Arquitectura operativa</h2><span>Modelo modular</span></div><p>Web, catálogo, contenidos, CRM, pedidos, inventario y pagos comparten un modelo de datos modular. Los pagos solo se confirman con el evento firmado de Wompi y cada venta confirmada descuenta inventario con trazabilidad.</p></article><article className="panel"><div className="panel-header"><h2>Integraciones</h2><span>Estado</span></div><div className="activity-list">
          <div className="activity-item"><ReceiptText /><span>Wompi · {wompiReady ? `conectado (${wompiMode})` : "faltan credenciales"}</span><small>{wompiReady ? "Activo" : "Configurar"}</small></div>
          <div className="activity-item"><Database /><span>Base de datos · {persistentDb ? "Turso persistente" : demo ? "demo con datos de prueba" : "archivo local de desarrollo"}</span><small>{persistentDb ? "Activo" : demo ? "Temporal" : "Solo local"}</small></div>
          <div className="activity-item"><Store /><span>WooCommerce · migración de productos y pedidos</span><small>Planificado</small></div>
        </div></article></section>
      </div>
    </main>
  </div>;
}
