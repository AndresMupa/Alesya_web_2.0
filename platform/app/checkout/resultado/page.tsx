import Link from "next/link";
import { CheckCircle2, Clock3, MessageCircle, XCircle } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { failedOrderStatuses, paidOrderStatuses, type OrderStatus } from "@/lib/commerce/constants";
import { findPublicOrder } from "@/lib/commerce/orders";
import { formatMoney } from "@/lib/format";
import { wompiStatus } from "@/lib/payments/wompi";

export const dynamic = "force-dynamic";
export const metadata = { title: "Estado del pedido | Alesya", robots: { index: false, follow: false } };

/** Estado real del pedido. La redirección del navegador desde Wompi nunca confirma un pago por sí sola. */
export default async function ResultPage({ searchParams }: { searchParams: Promise<{ referencia?: string }> }) {
  const { referencia } = await searchParams;
  const order = await findPublicOrder(referencia).catch((error) => { console.error("checkout_result_lookup_failed", error); return null; });
  const status = order?.status as OrderStatus | undefined;
  const paid = !!status && paidOrderStatuses.includes(status);
  const failed = !!status && failedOrderStatuses.includes(status);
  const manual = !!order && status === "payment_pending" && !wompiStatus().ready;
  const Icon = paid ? CheckCircle2 : failed ? XCircle : manual ? MessageCircle : Clock3;
  const title = !order ? "No encontramos el pedido" : paid ? "¡Pago confirmado!" : failed ? "El pago no se completó" : manual ? "¡Pedido recibido!" : "Estamos verificando tu pago";
  const copy = !order ? "Revisa el enlace o escríbenos con la referencia de tu compra." : paid ? "Recibimos la confirmación del pago. Te contactaremos para coordinar la entrega." : failed ? "El pago no fue aprobado o el pedido se canceló. Puedes intentarlo de nuevo o escribirnos si necesitas ayuda." : manual ? "Te escribiremos por WhatsApp para coordinar el pago y el envío. Si prefieres, escríbenos ya con tu referencia." : "Wompi nos enviará la confirmación segura en unos segundos. Recarga esta página para ver el estado actualizado.";
  const whatsapp = order ? `https://wa.me/573005937840?text=${encodeURIComponent(`Hola, hice el pedido ${order.reference} por ${formatMoney(order.totalInCents)} y quiero coordinar el pago y el envío.`)}` : "https://wa.me/573005937840";

  return <div className="checkout-page"><div className="interior-header is-solid"><SiteHeader /></div>
    <main className="store-result">
      <section className="checkout-card">
        <Icon size={54} className="store-result-icon" data-state={paid ? "ok" : failed ? "error" : "pending"} />
        <h1>{title}</h1>
        <p>{copy}</p>
        {order && <>
          <p>Referencia del pedido: <strong>{order.reference}</strong></p>
          <ul className="store-result-items">{order.items.map((item, index) => <li key={index}><span>{item.quantity} × {item.name}</span><strong>{formatMoney(item.lineTotalInCents)}</strong></li>)}<li><span>Total</span><strong>{formatMoney(order.totalInCents)}</strong></li></ul>
        </>}
        <div className="store-result-actions">
          {(manual || failed || !order) && <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="button button-primary"><MessageCircle size={18} /> Escribir por WhatsApp</a>}
          <Link href="/catalogo" className="button button-dark">Volver a la tienda</Link>
        </div>
      </section>
    </main>
  </div>;
}
