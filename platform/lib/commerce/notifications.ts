import "server-only";
import { getDb } from "@/db";
import { orderEvents } from "@/db/schema";
import { getOrderDetail } from "@/lib/commerce/orders";
import { formatMoney } from "@/lib/format";
import { renderEmail, sendMail } from "@/lib/mail";
import { storeConfig } from "@/lib/settings";

export type OrderMailKind = "received" | "paid" | "shipped";

/**
 * Correos del pedido al cliente (y aviso al equipo cuando entra uno nuevo). Nunca interrumpe la operación:
 * si el correo no está configurado o falla, queda registrado en la trazabilidad del pedido.
 */
export async function notifyOrder(kind: OrderMailKind, orderId: string, options: { origin: string; checkoutUrl?: string | null; detail?: string } ) {
  const [detail, config] = await Promise.all([getOrderDetail(orderId), storeConfig()]);
  if (!detail) return;
  const { order, items } = detail;
  const statusUrl = `${options.origin}/checkout/resultado?referencia=${encodeURIComponent(order.reference)}`;
  const whatsapp = `https://wa.me/${config.whatsappDigits}?text=${encodeURIComponent(`Hola, escribo por mi pedido ${order.reference}.`)}`;
  const rows: [string, string][] = [...items.map((item): [string, string] => [`${item.quantity} × ${item.productName}`, formatMoney(item.lineTotalInCents)]), ["Envío", order.shippingInCents ? formatMoney(order.shippingInCents) : "Se coordina"], ["Total", formatMoney(order.totalInCents)]];
  const firstName = order.customerName.split(" ")[0];
  const footer = `Referencia ${order.reference} · Estado del pedido: ${statusUrl} · WhatsApp: ${whatsapp}`;

  const message = kind === "received"
    ? renderEmail({
        title: `Recibimos tu pedido ${order.reference}`,
        intro: `Hola ${firstName}, gracias por comprar en Alesya X-Tech. Este es el resumen de tu pedido:`,
        rows,
        paragraphs: options.checkoutUrl ? ["Si aún no completaste el pago, puedes hacerlo con Nequi, PSE, Botón Bancolombia o tarjeta en el enlace de abajo."] : ["Cómo pagar:", config.paymentInstructions, config.shippingNote],
        cta: options.checkoutUrl ? { label: "Pagar ahora", url: options.checkoutUrl } : { label: "Escribirnos por WhatsApp", url: whatsapp },
        footer,
      })
    : kind === "paid"
      ? renderEmail({ title: `Pago confirmado · ${order.reference}`, intro: `Hola ${firstName}, confirmamos el pago de tu pedido. Ya lo estamos preparando y te avisaremos cuando salga.`, rows, paragraphs: [config.shippingNote], cta: { label: "Ver estado del pedido", url: statusUrl }, footer })
      : renderEmail({ title: `Tu pedido ${order.reference} va en camino`, intro: `Hola ${firstName}, tu pedido ya salió.${options.detail ? ` ${options.detail}.` : ""} Si tienes dudas sobre la entrega, escríbenos.`, rows, cta: { label: "Escribirnos por WhatsApp", url: whatsapp }, footer });

  const subject = kind === "received" ? `Recibimos tu pedido ${order.reference}` : kind === "paid" ? `Pago confirmado · ${order.reference}` : `Tu pedido ${order.reference} va en camino`;
  const result = await sendMail({ to: order.customerEmail, subject, replyTo: config.notifyTo, ...message });
  await recordNotification(orderId, `Correo “${subject}” a ${order.customerEmail}`, result);

  if (kind === "received" && config.notifyTo) {
    const team = renderEmail({
      title: `Nuevo pedido ${order.reference}`,
      intro: `${order.customerName} (${order.customerEmail}, ${order.customerPhone}) · ${order.shippingCity}. ${options.checkoutUrl ? "Pago por Wompi en curso." : "Pago a coordinar: registrarlo en el panel cuando llegue."}`,
      rows,
      paragraphs: [order.shippingAddress, order.customerNotes ? `Indicaciones: ${order.customerNotes}` : ""].filter(Boolean),
      cta: { label: "Abrir en el panel", url: `${options.origin}/admin/pedidos?pedido=${orderId}` },
      footer: "Aviso automático de la tienda Alesya.",
    });
    const teamResult = await sendMail({ to: config.notifyTo, subject: `Nuevo pedido ${order.reference} · ${formatMoney(order.totalInCents)}`, ...team });
    if (!teamResult.sent && teamResult.reason && !teamResult.reason.startsWith("Correo no configurado")) await recordNotification(orderId, `Aviso al equipo (${config.notifyTo})`, teamResult);
  }
}

async function recordNotification(orderId: string, label: string, result: { sent: boolean; reason?: string }) {
  if (!result.sent && result.reason?.startsWith("Correo no configurado")) return;
  await getDb().insert(orderEvents).values({ id: crypto.randomUUID(), orderId, type: "notification", detail: result.sent ? `${label}: enviado.` : `${label}: no se pudo enviar (${result.reason ?? "error"}).`, createdAt: new Date() }).catch((error) => console.error("notification_event_failed", error));
}

/** Aviso al equipo de un contacto nuevo que llegó por el formulario. */
export async function notifyNewLead(lead: { id: string; name: string; organization: string; email?: string | null; phone?: string | null; message: string; source: string }, origin: string) {
  const config = await storeConfig();
  if (!config.notifyTo) return;
  const mail = renderEmail({
    title: `Nuevo contacto: ${lead.organization}`,
    intro: `${lead.name} dejó una solicitud por ${lead.source}.`,
    rows: [["Correo", lead.email ?? "—"], ["Teléfono", lead.phone ?? "—"]],
    paragraphs: [lead.message],
    cta: { label: "Abrir en el CRM", url: `${origin}/admin/crm?lead=${lead.id}` },
    footer: "Aviso automático del CRM Alesya.",
  });
  await sendMail({ to: config.notifyTo, subject: `Nuevo contacto · ${lead.organization}`, ...mail });
}
