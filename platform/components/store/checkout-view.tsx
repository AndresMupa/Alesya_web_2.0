"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, CreditCard, LockKeyhole, MessageCircle, Smartphone } from "lucide-react";
import { cart, useCart } from "@/lib/commerce/cart-store";
import { formatMoney } from "@/lib/format";
import { useResolvedCart } from "@/components/store/use-resolved-cart";
import type { CartProduct } from "@/components/store/add-to-cart";

/**
 * Checkout del carrito. Con `buyNow` (enlace /checkout?producto=slug) agrega ese producto primero.
 * El servidor recalcula precios y stock; con Wompi redirige al pago, sin Wompi deja el pedido para coordinar.
 */
export function CheckoutView({ wompiReady, buyNow }: { wompiReady: boolean; buyNow: (CartProduct & { max: number }) | null }) {
  const router = useRouter();
  const { items } = useCart();
  const { data, loading } = useResolvedCart(items);
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState("");
  const addedBuyNow = useRef(false);

  useEffect(() => {
    if (!buyNow || addedBuyNow.current) return;
    addedBuyNow.current = true;
    const { max, ...product } = buyNow;
    if (!cart.has(product.slug)) cart.add(product, 1, max);
    window.history.replaceState(null, "", "/checkout");
  }, [buyNow]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    const customer = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: items.map(({ slug, quantity }) => ({ slug, quantity })), customer }) });
      const result = await response.json().catch(() => ({})) as { checkoutUrl?: string | null; resultUrl?: string; message?: string };
      if (!response.ok || !result.resultUrl) { setMessage(result.message ?? "No fue posible registrar el pedido."); setState("error"); return; }
      cart.clear();
      if (result.checkoutUrl) window.location.href = result.checkoutUrl;
      else router.push(result.resultUrl);
    } catch {
      setMessage("Sin conexión. Revisa tu internet e intenta de nuevo.");
      setState("error");
    }
  }

  if (!items.length && !buyNow) return <section className="store-empty checkout-card">
    <h1>No hay productos para pagar</h1>
    <p>Agrega productos al carrito desde la tienda.</p>
    <Link href="/catalogo" className="button button-dark">Ir a la tienda <ArrowRight size={17} /></Link>
  </section>;

  const blocked = !data || data.missing.length > 0 || data.lines.some((line) => line.problem);
  const shipping = data?.shippingInCents ?? 0;
  const total = (data?.subtotalInCents ?? 0) + shipping;

  return <div className="checkout-wrap store-checkout">
    <form className="checkout-card" onSubmit={submit}>
      <h1>Finaliza tu compra</h1>
      <p>Datos de contacto y entrega.</p>
      <div className="checkout-fields">
        <label>Nombre completo<input required name="name" autoComplete="name" minLength={2} maxLength={120} /></label>
        <label>Correo electrónico<input required type="email" name="email" autoComplete="email" maxLength={180} /></label>
        <label>Celular<input required name="phone" inputMode="tel" autoComplete="tel" minLength={7} maxLength={30} /></label>
        <label>Cédula o NIT (para la factura)<input name="document" maxLength={30} /></label>
        <label>Ciudad<input required name="city" autoComplete="address-level2" minLength={2} maxLength={100} /></label>
        <label>Dirección de entrega<input required name="address" autoComplete="street-address" minLength={5} maxLength={240} /></label>
        <label className="wide">Indicaciones (opcional)<textarea name="notes" rows={2} maxLength={1000} placeholder="Horario de entrega, colegio, persona que recibe…" /></label>
      </div>
      <h2 style={{ marginTop: 32 }}>Pago</h2>
      {wompiReady ? <>
        <div className="payment-methods"><span className="payment-method"><Smartphone /> Nequi</span><span className="payment-method"><Building2 /> PSE o Botón Bancolombia</span><span className="payment-method"><CreditCard /> Tarjeta débito o crédito</span></div>
        <p className="secure-note"><LockKeyhole size={28} />Eliges el medio en el checkout seguro de Wompi. Alesya no almacena números de tarjeta ni claves bancarias.</p>
      </> : <p className="secure-note"><MessageCircle size={28} />Registramos tu pedido y te contactamos por WhatsApp para coordinar el pago (transferencia, Nequi o Daviplata) y el envío.</p>}
      <label className="consent-check"><input type="checkbox" name="consent" required /><span>Autorizo a Alesya Ediciones a tratar mis datos para gestionar este pedido, según la <Link href="/politica-de-privacidad" target="_blank">Política de datos personales</Link>, y acepto las <Link href="/politica-de-reembolsos-y-devoluciones" target="_blank">condiciones de cambios y devoluciones</Link>.</span></label>
      {state === "error" && <div className="checkout-status" role="alert">{message}</div>}
      <button className="button button-primary" disabled={state === "saving" || loading || blocked} type="submit">
        {state === "saving" ? "Registrando pedido…" : wompiReady ? `Pagar ${formatMoney(total)}` : `Confirmar pedido por ${formatMoney(total)}`} <ArrowRight size={18} />
      </button>
    </form>
    <aside className="checkout-card">
      <h2>Resumen del pedido</h2>
      {data?.lines.map((line) => <div className="order-line" key={line.slug}><div><strong>{line.quantity} × {line.name}</strong>{line.problem && <p className="form-error">{line.problem}</p>}</div><strong>{formatMoney(line.lineTotalInCents)}</strong></div>)}
      {!data && <p>{loading ? "Calculando…" : ""}</p>}
      {data && data.missing.length > 0 && <div className="checkout-status">Un producto del carrito ya no está disponible. <Link href="/carrito">Revisa el carrito</Link>.</div>}
      <div className="order-line"><span>Envío</span><span>{shipping ? formatMoney(shipping) : "Se coordina al confirmar"}</span></div>
      <div className="order-total"><strong>Total</strong><strong>{formatMoney(total)}</strong></div>
      {data?.shippingNote && <p className="store-shipping-note">{data.shippingNote}</p>}
      <Link href="/carrito" className="underlined-link">Editar carrito</Link>
    </aside>
  </div>;
}
