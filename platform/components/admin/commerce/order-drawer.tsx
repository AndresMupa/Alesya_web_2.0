"use client";

import { FormEvent, useState } from "react";
import { Mail, MessageCircle, Truck } from "lucide-react";
import { Drawer, send, useJson } from "@/components/admin/kit";
import { isPendingStatus, manualPaymentMethods, orderEventLabels, orderStatusLabel, paymentMethodLabel } from "@/lib/commerce/constants";
import { formatDateTime, formatMoney, whatsappLink } from "@/lib/format";

type Order = { id: string; reference: string; customerName: string; customerEmail: string; customerPhone: string; customerDocument: string | null; shippingCity: string; shippingAddress: string; customerNotes: string; internalNotes: string; subtotalInCents: number; shippingInCents: number; totalInCents: number; status: string; createdAt: string; updatedAt: string };
type Detail = {
  order: Order; transitions: string[]; canConfirmPayment: boolean;
  items: { id: string; productSlug: string; productName: string; quantity: number; unitPriceInCents: number; lineTotalInCents: number }[];
  payments: { id: string; provider: string; method: string | null; status: string; amountInCents: number; reference: string; providerTransactionId: string | null; createdAt: string }[];
  events: { id: string; type: string; detail: string; createdBy: string | null; createdAt: string }[];
};

const paymentStatus: Record<string, string> = { pending: "Pendiente", approved: "Aprobado", declined: "Rechazado", voided: "Anulado", error: "Error", review: "En revisión", superseded: "Reemplazado", cancelled: "Cancelado" };
const actionLabel: Record<string, string> = { preparing: "Iniciar preparación", shipped: "Marcar enviado", delivered: "Marcar entregado", cancelled: "Cancelar pedido" };

export function StatusPill({ status }: { status: string }) {
  return <span className={`status-pill${isPendingStatus(status) ? " pending" : ""}`} data-status={status}>{orderStatusLabel(status)}</span>;
}

export function OrderDrawer({ orderId, onClose, onChanged }: { orderId: string | null; onClose: () => void; onChanged: () => void }) {
  const [revision, setRevision] = useState(0);
  const { data, error, loading } = useJson<Detail>(orderId ? `/api/admin/commerce/orders/${orderId}` : null, revision);
  const detail = data && data.order.id === orderId ? data : null;
  const reload = () => { setRevision((value) => value + 1); onChanged(); };
  const wa = detail && whatsappLink(detail.order.customerPhone, `Hola ${detail.order.customerName.split(" ")[0]}, te escribimos de Alesya por tu pedido ${detail.order.reference}.`);

  return <Drawer open={!!orderId} onClose={onClose}
    title={detail?.order.reference ?? (error || "Cargando pedido…")}
    subtitle={detail && <>{detail.order.customerName} · {formatDateTime(detail.order.createdAt)} · <StatusPill status={detail.order.status} /></>}
    actions={detail && <div className="adm-contact-links">{wa && <a href={wa} target="_blank" rel="noopener noreferrer" title="WhatsApp"><MessageCircle size={16} /></a>}<a href={`mailto:${detail.order.customerEmail}?subject=${encodeURIComponent(`Tu pedido ${detail.order.reference}`)}`} title="Correo"><Mail size={16} /></a></div>}>
    {!detail ? <p className="adm-muted">{loading ? "Cargando…" : error}</p> : <OrderDetail key={detail.order.updatedAt} detail={detail} reload={reload} />}
  </Drawer>;
}

function OrderDetail({ detail, reload }: { detail: Detail; reload: () => void }) {
  const { order } = detail;
  const [saving, setSaving] = useState(false);
  const [shippingNote, setShippingNote] = useState("");

  async function act(body: Record<string, unknown>, message: string) {
    setSaving(true);
    const result = await send(`/api/admin/commerce/orders/${order.id}`, "PATCH", body, message);
    setSaving(false);
    if (result) reload();
  }

  function transition(next: string) {
    if (next === "cancelled" && !confirm(`¿Cancelar el pedido ${order.reference}? El cliente no podrá pagarlo.`)) return;
    void act({ action: "status", status: next, detail: next === "shipped" ? shippingNote : "" }, `Pedido ${orderStatusLabel(next).toLowerCase()}.`);
  }

  function confirmPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!confirm(`¿Confirmas que recibiste ${formatMoney(order.totalInCents)} por el pedido ${order.reference}? Se descontará el inventario.`)) return;
    void act({ action: "manual_payment", method: form.get("method"), note: form.get("note") }, "Pago registrado. Pedido listo para preparar.");
  }

  return <div className="adm-order">
    {detail.transitions.length > 0 && <section className="adm-card adm-next">
      <h3>Siguiente paso</h3>
      {detail.transitions.includes("shipped") && <label>Guía o transportadora (opcional)<input value={shippingNote} onChange={(event) => setShippingNote(event.target.value)} maxLength={300} placeholder="Ej. Servientrega 123456789" /></label>}
      <div className="adm-actions-row">{detail.transitions.map((next) => <button key={next} type="button" disabled={saving} className={next === "cancelled" ? "refresh-button adm-danger" : "button button-dark"} onClick={() => transition(next)}>{next === "shipped" && <Truck size={16} />}{actionLabel[next] ?? orderStatusLabel(next)}</button>)}</div>
    </section>}

    {detail.canConfirmPayment && <form className="adm-card adm-form" onSubmit={confirmPayment}>
      <h3>Registrar pago recibido</h3>
      <p className="adm-muted">Úsalo cuando el cliente pagó por transferencia, Nequi directo, efectivo o datáfono. Los pagos de Wompi se confirman solos.</p>
      <div className="adm-form-grid">
        <label>Medio<select name="method" defaultValue="TRANSFER">{manualPaymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</select></label>
        <label>Referencia o comprobante<input name="note" maxLength={300} placeholder="N.º de transacción" /></label>
      </div>
      <button className="button button-primary" type="submit" disabled={saving}>Confirmar pago de {formatMoney(order.totalInCents)}</button>
    </form>}

    <section className="adm-card">
      <h3>Productos</h3>
      <table className="admin-table adm-table">
        <thead><tr><th>Producto</th><th>Cant.</th><th>Unitario</th><th>Total</th></tr></thead>
        <tbody>{detail.items.map((item) => <tr key={item.id}><td>{item.productName}<small>{item.productSlug}</small></td><td>{item.quantity}</td><td>{formatMoney(item.unitPriceInCents)}</td><td>{formatMoney(item.lineTotalInCents)}</td></tr>)}</tbody>
      </table>
      <div className="adm-totals"><span>Subtotal</span><b>{formatMoney(order.subtotalInCents)}</b><span>Envío</span><b>{order.shippingInCents ? formatMoney(order.shippingInCents) : "A coordinar"}</b><span>Total</span><strong>{formatMoney(order.totalInCents)}</strong></div>
    </section>

    <section className="adm-card">
      <h3>Cliente y entrega</h3>
      <dl className="adm-dl">
        <dt>Nombre</dt><dd>{order.customerName}</dd>
        <dt>Documento</dt><dd>{order.customerDocument ?? "—"}</dd>
        <dt>Correo</dt><dd><a href={`mailto:${order.customerEmail}`}>{order.customerEmail}</a></dd>
        <dt>Celular</dt><dd><a href={`tel:${order.customerPhone}`}>{order.customerPhone}</a></dd>
        <dt>Ciudad</dt><dd>{order.shippingCity}</dd>
        <dt>Dirección</dt><dd>{order.shippingAddress}</dd>
        {order.customerNotes && <><dt>Indicaciones</dt><dd>{order.customerNotes}</dd></>}
      </dl>
    </section>

    <section className="adm-card">
      <h3>Pagos</h3>
      <ul className="adm-plain-list">{detail.payments.map((payment) => <li key={payment.id}>
        <span>{payment.provider === "manual" ? "Manual" : "Wompi"} · {paymentMethodLabel(payment.method)}<small>{payment.reference}{payment.providerTransactionId ? ` · ${payment.providerTransactionId}` : ""}</small></span>
        <span className="adm-payment" data-status={payment.status}>{paymentStatus[payment.status] ?? payment.status}</span>
        <strong>{formatMoney(payment.amountInCents)}</strong>
      </li>)}</ul>
    </section>

    <form className="adm-card adm-form" onSubmit={(event) => { event.preventDefault(); void act({ action: "notes", internalNotes: String(new FormData(event.currentTarget).get("internalNotes") ?? "") }, "Nota guardada."); }}>
      <h3>Notas internas</h3>
      <textarea name="internalNotes" defaultValue={order.internalNotes} rows={3} maxLength={4000} placeholder="Solo visible para el equipo" />
      <button className="refresh-button" type="submit" disabled={saving}>Guardar nota</button>
    </form>

    <section className="adm-card">
      <h3>Trazabilidad</h3>
      <ol className="adm-timeline">{detail.events.map((event) => <li key={event.id} data-type={event.type}>
        <div><strong>{orderEventLabels[event.type] ?? event.type}</strong><time>{formatDateTime(event.createdAt)}</time></div>
        {event.detail && <p>{event.detail}</p>}
        {event.createdBy && <small>{event.createdBy}</small>}
      </li>)}</ol>
    </section>
  </div>;
}
