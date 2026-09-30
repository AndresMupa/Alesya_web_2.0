"use client";
/* eslint-disable @next/next/no-img-element -- fotos de /media y /uploads servidas tal cual (en cPanel no hay optimizador de imágenes). */

import Link from "next/link";
import { ArrowRight, Minus, PackageOpen, Plus, Trash2 } from "lucide-react";
import { cart, useCart } from "@/lib/commerce/cart-store";
import { stockState } from "@/lib/commerce/constants";
import { formatMoney } from "@/lib/format";
import { useResolvedCart } from "@/components/store/use-resolved-cart";

export function CartView() {
  const { items } = useCart();
  const { data, loading, error } = useResolvedCart(items);
  if (!items.length) return <section className="store-empty">
    <PackageOpen size={46} strokeWidth={1.2} />
    <h1>Tu carrito está vacío</h1>
    <p>Explora kits, componentes y libros para aprender construyendo.</p>
    <Link href="/catalogo" className="button button-dark">Ir a la tienda <ArrowRight size={17} /></Link>
  </section>;

  const lines = new Map(data?.lines.map((line) => [line.slug, line]));
  const blocked = !data || data.missing.length > 0 || data.lines.some((line) => line.problem);

  return <div className="store-cart">
    <section className="checkout-card">
      <h1>Carrito</h1>
      <ul className="store-lines">{items.map((item) => {
        const line = lines.get(item.slug);
        const missing = data?.missing.includes(item.slug);
        const max = line ? stockState(line).max : 99;
        return <li key={item.slug} className={missing || line?.problem ? "has-problem" : undefined}>
          <Link href={`/catalogo/${item.slug}`} className="store-line-image">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <PackageOpen size={26} />}</Link>
          <div className="store-line-info">
            <Link href={`/catalogo/${item.slug}`}><strong>{line?.name ?? item.name}</strong></Link>
            <small>{line ? formatMoney(line.priceInCents) : formatMoney(item.priceInCents)} c/u · {item.category}</small>
            {missing && <em>Ya no está disponible. Quítalo para continuar.</em>}
            {line?.problem && <em>{line.problem}</em>}
          </div>
          <div className="store-qty" role="group" aria-label={`Cantidad de ${item.name}`}>
            <button type="button" onClick={() => cart.setQuantity(item.slug, item.quantity - 1)} aria-label="Menos"><Minus size={15} /></button>
            <input value={item.quantity} inputMode="numeric" aria-label="Cantidad" onChange={(event) => cart.setQuantity(item.slug, Number(event.target.value.replace(/\D/g, "")) || 1)} />
            <button type="button" onClick={() => cart.setQuantity(item.slug, Math.min(max, item.quantity + 1))} aria-label="Más" disabled={item.quantity >= max}><Plus size={15} /></button>
          </div>
          <strong className="store-line-total">{line ? formatMoney(line.lineTotalInCents) : "—"}</strong>
          <button type="button" className="store-remove" onClick={() => cart.remove(item.slug)} aria-label={`Quitar ${item.name}`}><Trash2 size={16} /></button>
        </li>;
      })}</ul>
      <Link href="/catalogo" className="underlined-link">← Seguir comprando</Link>
    </section>
    <aside className="checkout-card">
      <h2>Resumen</h2>
      <div className="order-line"><span>Subtotal</span><strong>{data ? formatMoney(data.subtotalInCents) : "…"}</strong></div>
      <div className="order-line"><span>Envío</span><span>Se coordina al confirmar</span></div>
      <div className="order-total"><strong>Total</strong><strong>{data ? formatMoney(data.subtotalInCents) : "…"}</strong></div>
      {error && <div className="checkout-status">No pudimos verificar el carrito. Revisa tu conexión.</div>}
      {blocked && data && <div className="checkout-status">Ajusta los productos marcados para continuar.</div>}
      {blocked || loading ? <span className="button button-primary is-disabled" aria-disabled="true">Finalizar compra <ArrowRight size={18} /></span>
        : <Link href="/checkout" className="button button-primary">Finalizar compra <ArrowRight size={18} /></Link>}
    </aside>
  </div>;
}
