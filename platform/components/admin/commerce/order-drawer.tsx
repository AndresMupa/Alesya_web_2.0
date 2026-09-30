"use client";

import { FormEvent, useState } from "react";
import { AlertTriangle, Copy, ExternalLink, Link2, Mail, MessageCircle, Truck } from "lucide-react";
import { toast } from "sonner";
import { Drawer, send, useJson } from "@/components/admin/kit";
import { isPendingStatus, manualPaymentMethods, orderEventLabels, orderStatusLabel, paidOrderStatuses, paymentMethodLabel, type OrderStatus } from "@/lib/commerce/constants";
import { formatDateTime, formatMoney, whatsappLink } from "@/lib/format";

type Order = { id: string; reference: string; customerName: string; customerEmail: string; customerPhone: string; customerDocument: string | null; shippingCity: string; shippingAddress: string; customerNotes: string; internalNotes: string; subtotalInCents: number; shippingInCents: number; totalInCents: number; status: string; createdAt: string; updatedAt: string };
type Event = { id: string; type: string; detail: string; createdBy: string | null; createdAt: string };
type Detail = {
  order: Order; transitions: string[]; canConfirmPayment: boolean; canEditShipping: boolean; paymentLinkAvailable: boolean;
  config: { paymentInstructions: string; shippingNote: string };
  items: { id: string; productSlug: string; productName: string; quantity: number; unitPriceInCents: number; lineTotalInCents: number }[];
  payments: { id: string; provider: string; method: string | null; status: string; amountInCents: number; reference: string; providerTransactionId: string | null; createdAt: string }[];
  events: Event[];
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

/** Mensajes al cliente según el estado del pedido. Marcadores: {nombre} {referencia} {total} {instrucciones} {enlace_pago} {guia}. */
function customerTemplate(order: Order, paymentUrl: string | null, guide: string, instructions: string) {
  const values: Record<string, string> = { nombre: order.customerName.split(" ")[0], referencia: order.reference, total: formatMoney(order.totalInCents), instrucciones: instructions, enlace_pago: paymentUrl ?? "", guia: guide || "(pendiente)" };
  const status = order.status as OrderStatus;
  const text = paidOrderStatuses.includes(status)
    ? status === "shipped" ? "Hola {nombre}, tu pedido {referencia} ya salió. Guía o transportadora: {guia}. Cualquier duda con la entrega, escríbenos por aquí."
      : status === "delivered" ? "Hola {nombre}, ¿ya recibiste tu pedido {referencia}? Esperamos que lo disfruten. Si necesitas algo más, por aquí estamos."
        : "Hola {nombre}, confirmamos el pago de tu pedido {referencia} por {total}. Ya lo estamos preparando y te avisamos cuando salga."
    : paymentUrl
      ? "Hola {nombre}, tu pedido {referencia} por {total} está listo para pagar con Nequi, PSE, Botón Bancolombia o tarjeta en este enlace: {enlace_pago}\n\nCuando pagues, lo preparamos de inmediato."
      : "Hola {nombre}, recibimos tu pedido {referencia} por {total}.\n\n{instrucciones}\n\nCuando hagas el pago envíanos el comprobante por aquí y lo preparamos.";
  return text.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}

function OrderDetail({ detail, reload }: { detail: Detail; reload: () => void }) {
  const { order } = detail;
  const [saving, setSaving] = useState(false);
  const [shippingNote, setShippingNote] = useState("");
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [message, setMessage] = useState("");
  const shippedEvent = detail.events.find((event) => event.type === "status" && event.detail.includes("→ Enviado"));
  const guide = shippedEvent?.detail.split(" · ")[1] ?? "";
  const stockWarnings = detail.events.filter((event) => event.type === "stock_warning");
  const wa = whatsappLink(order.customerPhone, message || customerTemplate(order, paymentUrl, guide, detail.config.paymentInstructions));

  async function act(body: Record<string, unknown>, message: string) {
    setSaving(true);
    const result = await send(`/api/admin/commerce/orders/${order.id}`, "PATCH", body, message);
    setSaving(false);
    if (result) reload();
  }

  function transition(next: string) {
    if (next === "cancelled" && !confirm(`¿Cancelar el pedido ${order.reference}? El cliente no podrá pagarlo.`)) return;
    void act({ action: "status", status: next, detail: next === "shipped" ? shippingNote : "" }, `Pedido ${orderStatusLabel(next).toLowerCase()}.${next === "shipped" ? " Correo de envío enviado si hay SMTP." : ""}`);
  }

  function confirmPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!confirm(`¿Confirmas que recibiste ${formatMoney(order.totalInCents)} por el pedido ${order.reference}? Se descontará el inventario.`)) return;
    void act({ action: "manual_payment", method: form.get("method"), note: form.get("note") }, "Pago registrado. Pedido listo para preparar.");
  }

  async function paymentLink() {
    setSaving(true);
    const result = await send<{ url: string }>(`/api/admin/commerce/orders/${order.id}`, "PATCH", { action: "payment_link" }, "Enlace de pago generado.");
    setSaving(false);
    if (result) { setPaymentUrl(result.url); setMessage(""); setComposing(true); }
  }

  function openComposer() { setMessage((current) => current || customerTemplate(order, paymentUrl, guide, detail.config.paymentInstructions)); setComposing(true); }

  return <div className="adm-order">
    {stockWarnings.length > 0 && <div className="adm-warning-box"><AlertTriangle size={16} /><div><strong>Revisa el inventario antes de preparar.</strong>{stockWarnings.map((event) => <p key={event.id}>{event.detail}</p>)}</div></div>}

    {detail.transitions.length > 0 && <section className="adm-card adm-next">
      <h3>Siguiente paso</h3>
      {detail.transitions.includes("shipped") && <label>Guía o transportadora (opcional, va en el correo al cliente)<input value={shippingNote} onChange={(event) => setShippingNote(event.target.value)} maxLength={300} placeholder="Ej. Servientrega 123456789" /></label>}
      <div className="adm-actions-row">{detail.transitions.map((next) => <button key={next} type="button" disabled={saving} className={next === "cancelled" ? "refresh-button adm-danger" : "button button-dark"} onClick={() => transition(next)}>{next === "shipped" && <Truck size={16} />}{actionLabel[next] ?? orderStatusLabel(next)}</button>)}</div>
    </section>}

    {detail.canConfirmPayment && <section className="adm-card">
      <h3>Cobrar</h3>
      {detail.canEditShipping && <form className="adm-inline-form" onSubmit={(event) => { event.preventDefault(); void act({ action: "shipping", shippingCop: Number(new FormData(event.currentTarget).get("shippingCop")) || 0 }, "Envío actualizado; el total y el cobro cambian."); }}>
        <label>Costo de envío (COP)<input name="shippingCop" type="number" min="0" step="1000" defaultValue={Math.round(order.shippingInCents / 100)} /></label>
        <button className="refresh-button" type="submit" disabled={saving}>Guardar envío</button>
        <small className="adm-muted">Total actual: <strong>{formatMoney(order.totalInCents)}</strong>. Solo se puede cambiar antes del pago.</small>
      </form>}
      <div className="adm-actions-row">
        {detail.paymentLinkAvailable ? <button type="button" className="button button-primary" disabled={saving} onClick={() => void paymentLink()}><Link2 size={15} /> Enlace de pago Wompi</button>
          : <span className="adm-muted">Sin Wompi configurado: envía las instrucciones de pago y registra el pago cuando llegue.</span>}
        <button type="button" className="refresh-button" onClick={openComposer}><MessageCircle size={14} /> Escribir al cliente</button>
      </div>
      {paymentUrl && <div className="adm-paylink"><input readOnly value={paymentUrl} aria-label="Enlace de pago" onFocus={(event) => event.currentTarget.select()} /><button type="button" className="refresh-button" onClick={() => { void navigator.clipboard.writeText(paymentUrl).then(() => toast.success("Enlace copiado."), () => toast.error("No se pudo copiar.")); }}><Copy size={14} /> Copiar</button><a className="refresh-button" href={paymentUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Abrir</a></div>}
      <form className="adm-form" onSubmit={confirmPayment}>
        <h4>Registrar pago recibido</h4>
        <p className="adm-muted">Transferencia, Nequi directo, efectivo o datáfono. Los pagos de Wompi se confirman solos.</p>
        <div className="adm-form-grid">
          <label>Medio<select name="method" defaultValue="TRANSFER">{manualPaymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</select></label>
          <label>Referencia o comprobante<input name="note" maxLength={300} placeholder="N.º de transacción" /></label>
        </div>
        <button className="button button-dark" type="submit" disabled={saving}>Confirmar pago de {formatMoney(order.totalInCents)}</button>
      </form>
    </section>}

    {(composing || !detail.canConfirmPayment) && <section className="adm-card adm-order-composer">
      <div className="adm-card-row"><h3><MessageCircle size={15} /> Escribir al cliente</h3>{composing && <button type="button" className="adm-link-button" onClick={() => setComposing(false)}>Ocultar</button>}</div>
      {(composing || !detail.canConfirmPayment) && <>
        <textarea value={message || customerTemplate(order, paymentUrl, guide, detail.config.paymentInstructions)} onChange={(event) => setMessage(event.target.value)} rows={6} maxLength={2000} aria-label="Mensaje al cliente" />
        <div className="adm-composer-actions">
          {wa ? <a className="button button-primary" href={wa} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} /> Abrir WhatsApp</a> : <span className="adm-muted">El celular del pedido no sirve para WhatsApp.</span>}
          <button type="button" className="refresh-button" onClick={() => { void navigator.clipboard.writeText(message || customerTemplate(order, paymentUrl, guide, detail.config.paymentInstructions)).then(() => toast.success("Mensaje copiado."), () => toast.error("No se pudo copiar.")); }}><Copy size={14} /> Copiar</button>
        </div>
      </>}
    </section>}

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
