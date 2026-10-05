import { PackageSearch } from "lucide-react";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Rastrear pedido", robots: { index: false, follow: false } };

/** El cliente escribe la referencia de su pedido (ALESYA-…) y ve el estado real, sin datos de contacto. */
export default function TrackOrderPage() {
  return <div className="checkout-page"><div className="interior-header is-solid"><SiteHeader /></div>
    <main className="store-result">
      <section className="checkout-card">
        <PackageSearch size={54} className="store-result-icon" />
        <h1>¿Cómo va mi pedido?</h1>
        <p>Escribe la referencia que recibiste al comprar (empieza por ALESYA-). Está en el correo de confirmación y en la página que viste al terminar la compra.</p>
        <form className="store-track" action="/checkout/resultado" method="get">
          <input name="referencia" required pattern="[A-Za-z0-9-]{8,80}" placeholder="ALESYA-XXXXXXXX-XXXXXX" aria-label="Referencia del pedido" autoCapitalize="characters" autoComplete="off" />
          <button className="button button-dark" type="submit">Ver estado</button>
        </form>
        <p className="store-shipping-note">Si no encuentras la referencia, escríbenos por WhatsApp con tu nombre y te ayudamos.</p>
      </section>
    </main>
  </div>;
}
