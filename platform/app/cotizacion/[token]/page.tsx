import { notFound } from "next/navigation";
import { BrandLockup } from "@/components/brand-lockup";
import { QuoteDecision } from "@/components/quote-decision";
import { quoteStatusLabel } from "@/lib/crm/constants";
import { getQuoteByToken } from "@/lib/crm/quotes";
import { formatDay, formatMoney } from "@/lib/format";
import { storeConfig } from "@/lib/settings";
import "./quote.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cotización", robots: { index: false, follow: false } };

/** Cotización pública por enlace: el colegio la revisa, la imprime o guarda en PDF y la acepta en línea. */
export default async function QuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [quote, config] = await Promise.all([getQuoteByToken(token).catch(() => null), storeConfig().catch(() => null)]);
  if (!quote) notFound();
  const status = quote.expired ? "expired" : quote.status;
  const whatsapp = `https://wa.me/${config?.whatsappDigits ?? "573005937840"}?text=${encodeURIComponent(`Hola, tengo una pregunta sobre la cotización ${quote.number}.`)}`;
  const issued = new Date(quote.createdAt).toISOString().slice(0, 10);

  return <main className="quote-page">
    <article className="quote-doc">
      <header className="quote-head">
        <BrandLockup />
        <div className="quote-meta"><p className="eyebrow">Cotización</p><h1>{quote.number}</h1><dl><dt>Fecha</dt><dd>{formatDay(issued)}</dd><dt>Vigente hasta</dt><dd>{formatDay(quote.validUntil)}</dd></dl></div>
      </header>
      {status !== "sent" && status !== "draft" && <p className="quote-banner" data-status={status}>{status === "accepted" ? "Cotización aceptada. Gracias por confiar en Alesya." : status === "rejected" ? "Esta cotización fue rechazada." : "Esta cotización venció. Escríbenos y te enviamos una actualizada."}</p>}
      <section className="quote-for">
        <div><p className="eyebrow">Para</p><strong>{quote.lead.organization}</strong><span>{quote.lead.contact}{quote.lead.city && ` · ${quote.lead.city}`}</span></div>
        <div><p className="eyebrow">Propuesta</p><strong>{quote.title}</strong><span>{quoteStatusLabel(quote.status)}{quote.expired ? " · vencida" : ""}</span></div>
      </section>
      <table className="quote-items">
        <thead><tr><th>Descripción</th><th>Cant.</th><th>Unitario</th><th>Total</th></tr></thead>
        <tbody>{quote.items.map((item, index) => <tr key={index}><td>{item.description}</td><td>{item.quantity.toLocaleString("es-CO")}</td><td>{formatMoney(item.unitPriceInCents)}</td><td>{formatMoney(Math.round(item.quantity * item.unitPriceInCents))}</td></tr>)}</tbody>
        <tfoot>
          <tr><td colSpan={3}>Subtotal</td><td>{formatMoney(quote.subtotalInCents)}</td></tr>
          {quote.discountInCents > 0 && <tr><td colSpan={3}>Descuento</td><td>− {formatMoney(quote.discountInCents)}</td></tr>}
          <tr className="quote-total"><td colSpan={3}>Total</td><td>{formatMoney(quote.totalInCents)}</td></tr>
        </tfoot>
      </table>
      {quote.notes && <section className="quote-notes"><p className="eyebrow">Alcance y notas</p><p>{quote.notes}</p></section>}
      <section className="quote-terms"><p className="eyebrow">Condiciones</p><p>{quote.terms}</p></section>
      <QuoteDecision token={token} decidable={status === "sent"} />
      <footer className="quote-foot">
        <p>Alesya Ediciones · Alesya X-Tech · Funza, Colombia · comercial@alesyaediciones.com · +57 300 593 7840</p>
        <p className="print-hide">¿Dudas? <a href={whatsapp} target="_blank" rel="noopener noreferrer">Escríbenos por WhatsApp</a>.</p>
      </footer>
    </article>
  </main>;
}
