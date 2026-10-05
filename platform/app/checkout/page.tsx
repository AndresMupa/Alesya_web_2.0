import { SiteHeader } from "@/components/site-header";
import { CheckoutView } from "@/components/store/checkout-view";
import { getStoreProduct } from "@/lib/commerce/catalog";
import { stockState } from "@/lib/commerce/constants";
import { wompiStatus } from "@/lib/payments/wompi";

export const dynamic = "force-dynamic";
export const metadata = { title: "Finalizar compra", robots: { index: false, follow: false } };

/** `/checkout?producto=<slug>` (enlaces de "comprar" antiguos y de campañas) agrega ese producto al carrito. */
export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ producto?: string }> }) {
  const { producto } = await searchParams;
  const product = producto ? await getStoreProduct(producto).catch(() => null) : null;
  const state = product ? stockState(product) : null;
  const buyNow = product && state?.purchasable ? { slug: product.slug, name: product.name, priceInCents: product.priceInCents, imageUrl: product.imageUrl, category: product.category, max: state.max } : null;
  return <div className="checkout-page"><div className="interior-header is-solid"><SiteHeader /></div><main><CheckoutView wompiReady={wompiStatus().ready} buyNow={buyNow} /></main></div>;
}
