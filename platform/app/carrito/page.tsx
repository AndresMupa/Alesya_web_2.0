import { SiteHeader } from "@/components/site-header";
import { CartView } from "@/components/store/cart-view";

export const metadata = { title: "Carrito", robots: { index: false, follow: false } };

export default function CartPage() {
  return <div className="checkout-page"><div className="interior-header is-solid"><SiteHeader /></div><main className="checkout-wrap store-cart-wrap"><CartView /></main></div>;
}
