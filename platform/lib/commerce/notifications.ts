import "server-only";
import { getDb } from "@/db";
import { orderEvents } from "@/db/schema";
import { getOrderDetail } from "@/lib/commerce/orders";
import { WAITLIST_PROGRAM } from "@/lib/crm/constants";
import { budgetLabel, gradesLabel, sectorLabel, techLevelLabel } from "@/lib/crm/score";
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

type FormLead = {
  name: string; organization: string; email?: string | null; phone?: string | null; message: string; source: string; grades?: string | null; students?: number; program?: string | null;
  sector?: string | null; techLevel?: string | null; budgetRange?: string | null; competitors?: string | null;
  /** Lista de espera: nombre del producto del catálogo. */
  productName?: string;
  /** Enlace de baja de comunicaciones comerciales que se incluye en el pie del correo al contacto. */
  unsubscribeUrl?: string;
};

/** Aviso al equipo de un contacto nuevo que llegó por el formulario. */
export async function notifyNewLead(lead: FormLead & { id: string }, origin: string) {
  const config = await storeConfig();
  if (!config.notifyTo) return;
  const qualification: [string, string][] = [
    ["Programa", lead.program ?? ""], ["Grados", gradesLabel(lead.grades) ?? ""], ["Estudiantes", lead.students ? `≈ ${lead.students.toLocaleString("es-CO")}` : ""],
    ["Sector", sectorLabel(lead.sector) ?? ""], ["Nivel de robótica", techLevelLabel(lead.techLevel) ?? ""], ["Presupuesto", budgetLabel(lead.budgetRange) ?? ""], ["Plataforma actual", lead.competitors ?? ""],
  ];
  const mail = renderEmail({
    title: `Nuevo contacto: ${lead.organization}`,
    intro: lead.program === WAITLIST_PROGRAM ? `${lead.name} se anotó en la lista de espera por ${lead.source}.` : `${lead.name} dejó una solicitud por ${lead.source}.`,
    rows: [["Correo", lead.email ?? "—"], ["Teléfono", lead.phone ?? "—"], ...qualification.filter(([, value]) => value)],
    paragraphs: [lead.message],
    cta: { label: "Abrir en el CRM", url: `${origin}/admin/crm?lead=${lead.id}` },
    footer: "Aviso automático del CRM Alesya.",
  });
  await sendMail({ to: config.notifyTo, subject: `Nuevo contacto · ${lead.organization}`, ...mail });
}

/**
 * Respuesta inmediata a quien deja el formulario: confirma que llegó, promete contacto el mismo día hábil y deja
 * el WhatsApp para adelantar la conversación. Las respuestas a este correo llegan al buzón comercial.
 */
export async function sendLeadAutoReply(lead: FormLead) {
  if (!lead.email) return;
  const config = await storeConfig();
  const firstName = lead.name.split(" ")[0];
  const phone = config.whatsappDigits.replace(/^57(\d{3})(\d{3})(\d{4})$/, "+57 $1 $2 $3");
  const waitlist = lead.program === WAITLIST_PROGRAM;
  const whatsapp = `https://wa.me/${config.whatsappDigits}?text=${encodeURIComponent(waitlist ? `Hola Alesya, soy ${firstName}. Me anoté en la lista de espera${lead.productName ? ` de ${lead.productName}` : ""}.` : `Hola Alesya, soy ${firstName} de ${lead.organization}. Acabo de solicitar el diagnóstico en la web.`)}`;
  const mail = renderEmail({
    title: waitlist ? "Quedaste en la lista de espera" : "Recibimos tu solicitud de diagnóstico",
    intro: waitlist
      ? `Hola ${firstName}, te anotamos en la lista de espera${lead.productName ? ` de ${lead.productName}` : ""}. Todavía no tenemos una fecha confirmada: te escribiremos a este correo apenas la tengamos.`
      : `Hola ${firstName}, gracias por escribirnos. Una persona del equipo comercial te contactará el mismo día hábil para conocer ${lead.organization} y agendar el diagnóstico${lead.program ? ` del programa de ${lead.program.toLowerCase()}` : ""}.`,
    paragraphs: [`Si prefieres adelantar la conversación, escríbenos por WhatsApp al ${phone}.`],
    cta: { label: "Escribirnos por WhatsApp", url: whatsapp },
    footer: `Alesya Ediciones · Alesya X-Tech · WhatsApp ${phone}${config.notifyTo ? ` · ${config.notifyTo}` : ""}`,
    footerLink: lead.unsubscribeUrl ? { label: "Dejar de recibir comunicaciones comerciales", url: lead.unsubscribeUrl } : undefined,
  });
  await sendMail({ to: lead.email, subject: waitlist ? "Estás en la lista de espera · Alesya" : "Recibimos tu solicitud · Alesya", replyTo: config.notifyTo || undefined, ...mail,
    // Baja en un clic (RFC 8058) hacia /api/baja/[token], que acepta POST sin sesión.
    ...(lead.unsubscribeUrl && { headers: { "List-Unsubscribe": `<${lead.unsubscribeUrl.replace("/baja/", "/api/baja/")}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }) });
}
