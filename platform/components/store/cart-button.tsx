"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/commerce/cart-store";

export function CartButton() {
  const { count } = useCart();
  return <Link href="/carrito" className="cart-link" aria-label={count ? `Carrito: ${count} productos` : "Carrito vacío"}>
    <ShoppingBag size={20} />
    {count > 0 && <span className="cart-count">{count > 99 ? "99+" : count}</span>}
  </Link>;
}
