import { Suspense } from "react";
import { CheckoutForm } from "@/components/checkout-form";
import { SiteHeader } from "@/components/site-header";
import { findCheckoutProduct } from "@/lib/product-service";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ producto?: string }> }) {
  const { producto } = await searchParams; const product = await findCheckoutProduct(producto);
  const checkoutProduct = { slug: product.slug, name: product.name, price: product.price, priceInCents: product.priceInCents, description: product.description };
  return <div className="checkout-page"><div className="interior-header"><SiteHeader /></div><main className="checkout-wrap"><Suspense><CheckoutForm product={checkoutProduct} /></Suspense><aside className="checkout-card"><h2>Resumen del pedido</h2><div className="order-line"><div><strong>{product.name}</strong><p>{product.description}</p></div><strong>{product.price}</strong></div><div className="order-line"><span>Envío</span><span>Calculado al confirmar</span></div><div className="order-total"><strong>Total</strong><strong>{product.price}</strong></div><div className="checkout-status">Ambiente seguro preparado para Wompi. El cobro real se habilita únicamente al configurar las llaves del comercio.</div></aside></main></div>;
}
