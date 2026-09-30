"use client";

import { useEffect, useState } from "react";
import type { CartItem } from "@/lib/commerce/cart-store";

export type ResolvedLine = { slug: string; name: string; category: string; priceInCents: number; imageUrl: string | null; stock: number; backorder: boolean; quantity: number; lineTotalInCents: number; available: boolean; problem: string | null };
type Resolved = { lines: ResolvedLine[]; missing: string[]; subtotalInCents: number; shippingInCents: number; shippingNote: string };

/** Pide al servidor precios y disponibilidad actuales del carrito cada vez que cambia. */
export function useResolvedCart(items: CartItem[]) {
  const key = JSON.stringify(items.map((item) => [item.slug, item.quantity]));
  const [state, setState] = useState<{ key: string; data: Resolved | null; error: boolean }>({ key: "", data: null, error: false });
  useEffect(() => {
    if (key === "[]") return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch("/api/store/cart", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: JSON.parse(key).map(([slug, quantity]: [string, number]) => ({ slug, quantity })) }), signal: controller.signal })
        .then((response) => response.ok ? response.json() as Promise<Resolved> : Promise.reject(new Error("cart")))
        .then((data) => setState({ key, data, error: false }), () => { if (!controller.signal.aborted) setState({ key, data: null, error: true }); });
    }, 150);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [key]);
  const empty = key === "[]";
  // Mientras llega la respuesta se conserva el último resultado para no parpadear.
  return { data: empty ? { lines: [], missing: [], subtotalInCents: 0, shippingInCents: 0, shippingNote: "" } : state.data, loading: !empty && state.key !== key, error: state.key === key && state.error };
}
