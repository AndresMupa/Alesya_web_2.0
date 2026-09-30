import { CreditCard, Database, HardDrive, Mail, MessageCircle, ReceiptText, Store } from "lucide-react";
import { demoDatabase } from "@/db";
import { requireAdmin } from "@/lib/admin-auth";
import { wompiStatus } from "@/lib/payments/wompi";
import { uploadsAvailable } from "@/lib/storage";
import { PageHeader } from "@/components/admin/kit";

export const metadata = { title: "Integraciones" };

export default async function IntegrationsPage() {
  await requireAdmin();
  const wompi = wompiStatus();
  const demo = demoDatabase();
  const turso = Boolean(process.env.TURSO_DATABASE_URL && !process.env.TURSO_DATABASE_URL.startsWith("file:"));
  const items = [
    { icon: ReceiptText, name: "Wompi · checkout", detail: wompi.ready ? `Conectado en ${wompi.mode}. Nequi, PSE, Botón Bancolombia y tarjetas.` : "Sin llaves: los pedidos se registran y el pago se coordina por WhatsApp o transferencia (se confirma en Pedidos → Registrar pago).", state: wompi.ready ? "Activo" : "Configurar", ok: wompi.ready },
    { icon: CreditCard, name: "Wompi · webhook de eventos", detail: wompi.webhookReady ? "Recibe /api/webhooks/wompi con firma verificada." : "Falta WOMPI_EVENTS_SECRET: los pagos en línea no se confirmarían solos.", state: wompi.webhookReady ? "Activo" : "Configurar", ok: wompi.webhookReady },
    { icon: Database, name: "Base de datos", detail: turso ? "Turso persistente." : demo ? "Demo con datos de prueba." : process.env.NODE_ENV === "production" ? "SQLite privada en la carpeta de datos del hosting (fuera de la app)." : "Archivo local de desarrollo (.local/alesya.db).", state: demo ? "Temporal" : "Activo", ok: !demo },
    { icon: HardDrive, name: "Fotos de productos", detail: uploadsAvailable() ? "Las fotos subidas desde el panel se guardan en la carpeta de datos y se sirven en /uploads/…; sobreviven a los despliegues." : "Este alojamiento no tiene disco persistente: usa rutas /media/… o URLs https.", state: uploadsAvailable() ? "Activo" : "No disponible", ok: uploadsAvailable() },
    { icon: MessageCircle, name: "WhatsApp comercial", detail: "Enlaces wa.me desde fichas de contacto, pedidos y la página de colegios. Las conversaciones se registran a mano en el CRM.", state: "Enlaces", ok: true },
    { icon: Mail, name: "Correo transaccional", detail: "Aún no hay proveedor de correo: las confirmaciones de pedido se envían por WhatsApp o correo manual.", state: "Pendiente", ok: false },
    { icon: Store, name: "WooCommerce", detail: "Migración de productos y pedidos históricos: importar el CSV de productos desde Productos → Importar.", state: "Planificado", ok: false },
  ];
  return <>
    <PageHeader title="Integraciones" description="Estado de los servicios conectados a la plataforma." />
    <section className="panel adm-section">
      <ul className="adm-integrations">{items.map(({ icon: Icon, name, detail, state, ok }) => <li key={name}><Icon /><div><strong>{name}</strong><p>{detail}</p></div><span className={`status-pill${ok ? "" : " pending"}`}>{state}</span></li>)}</ul>
    </section>
    <section className="panel adm-section">
      <div className="panel-header"><h2>Arquitectura</h2><span>Módulos</span></div>
      <p className="adm-muted">La plataforma separa <strong>CRM</strong> (contactos, gestiones, embudo), <strong>comercio</strong> (catálogo, carrito, pedidos, inventario) y <strong>pagos</strong> (adaptador Wompi y pagos manuales). Los pagos en línea solo se confirman con el evento firmado de Wompi; cada venta confirmada descuenta inventario con trazabilidad y cada pedido guarda su historial de eventos.</p>
    </section>
  </>;
}
