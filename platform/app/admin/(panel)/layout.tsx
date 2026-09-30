import Link from "next/link";
import { Toaster } from "sonner";
import { demoDatabase } from "@/db";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminNav } from "@/components/admin/admin-nav";
import { BrandLockup } from "@/components/brand-lockup";
import "../admin.css";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Centro de operaciones | Alesya", template: "%s | Operaciones Alesya" }, robots: { index: false, follow: false } };

/** Marco del panel: todas las páginas de aquí exigen sesión (y cada página vuelve a comprobarla). */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <BrandLockup operations />
      <AdminNav />
      <Link className="admin-back" href="/">← Volver al sitio</Link>
    </aside>
    <main className="admin-main">
      <header className="admin-topbar">
        <span className="adm-topbar-title">Centro de operaciones</span>
        <div className="admin-user"><span>{admin.email}</span><form action="/api/admin/logout" method="post"><button className="refresh-button">Cerrar sesión</button></form></div>
      </header>
      <div className="admin-content">
        {demoDatabase() && <p className="checkout-status admin-demo-banner"><strong>Entorno de pruebas.</strong> Todos los datos son ficticios y pueden reiniciarse.</p>}
        {children}
      </div>
    </main>
    <Toaster position="bottom-right" richColors closeButton />
  </div>;
}
