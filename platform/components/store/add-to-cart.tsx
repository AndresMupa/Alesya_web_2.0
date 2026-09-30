"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus, ShoppingCart } from "lucide-react";
import { cart } from "@/lib/commerce/cart-store";

export type CartProduct = { slug: string; name: string; priceInCents: number; imageUrl: string | null; category: string };

/** Botón compacto de las tarjetas del catálogo. */
export function AddToCartButton({ product, max, disabled }: { product: CartProduct; max: number; disabled?: boolean }) {
  const [added, setAdded] = useState(false);
  return <button type="button" className="store-add" disabled={disabled} aria-label={disabled ? `${product.name} agotado` : `Agregar ${product.name} al carrito`}
    onClick={() => { cart.add(product, 1, max); setAdded(true); setTimeout(() => setAdded(false), 1600); }}>
    {added ? <Check size={19} /> : <ShoppingCart size={19} />}
  </button>;
}

/** Selector de cantidad + agregar / comprar ahora de la ficha de producto. */
export function AddToCartPanel({ product, max, disabled }: { product: CartProduct; max: number; disabled?: boolean }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  if (disabled) return <p className="store-soldout">Agotado por ahora. Escríbenos y te avisamos cuando vuelva.</p>;
  return <div className="store-buy">
    <div className="store-qty" role="group" aria-label="Cantidad">
      <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Menos" disabled={quantity <= 1}><Minus size={16} /></button>
      <input value={quantity} inputMode="numeric" aria-label="Cantidad" onChange={(event) => setQuantity(Math.max(1, Math.min(max, Number(event.target.value.replace(/\D/g, "")) || 1)))} />
      <button type="button" onClick={() => setQuantity(Math.min(max, quantity + 1))} aria-label="Más" disabled={quantity >= max}><Plus size={16} /></button>
    </div>
    <button type="button" className="button button-dark" onClick={() => { cart.add(product, quantity, max); setAdded(true); }}>{added ? <><Check size={18} /> En el carrito</> : <><ShoppingCart size={18} /> Agregar al carrito</>}</button>
    <button type="button" className="button button-primary" onClick={() => { cart.add(product, quantity, max); router.push("/checkout"); }}>Comprar ahora</button>
  </div>;
}
