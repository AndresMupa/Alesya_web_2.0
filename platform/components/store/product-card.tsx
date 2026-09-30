/* eslint-disable @next/next/no-img-element -- fotos de /media y /uploads servidas tal cual (en cPanel no hay optimizador de imágenes). */
import Link from "next/link";
import type { StoreProduct } from "@/lib/commerce/catalog";
import { stockState } from "@/lib/commerce/constants";
import { categoryMeta } from "@/lib/content";
import { formatMoney } from "@/lib/format";
import { AddToCartButton } from "@/components/store/add-to-cart";

export function ProductVisual({ product, size = 76 }: { product: Pick<StoreProduct, "imageUrl" | "category" | "name">; size?: number }) {
  const { icon: Icon } = categoryMeta(product.category);
  return product.imageUrl ? <img src={product.imageUrl} alt={product.name} loading="lazy" /> : <Icon size={size} strokeWidth={1.15} />;
}

/** Tarjeta de producto de la tienda (portada, catálogo y relacionados). */
export function ProductCard({ product }: { product: StoreProduct }) {
  const state = stockState(product);
  const { tone } = categoryMeta(product.category);
  const href = `/catalogo/${product.slug}`;
  return <article className="product-card store-card">
    <Link href={href} className={`product-visual${product.imageUrl ? " has-image" : ""}`} data-tone={tone} aria-label={product.name}>
      <ProductVisual product={product} />
      <span data-state={state.purchasable ? (state.label === "Disponible" ? "ok" : "low") : "out"}>{product.featured && state.label === "Disponible" ? "Destacado" : state.label}</span>
    </Link>
    <div className="product-copy">
      <p className="product-type">{product.category}</p>
      <h3><Link href={href}>{product.name}</Link></h3>
      <p>{product.description}</p>
      <div className="product-footer">
        <strong>{formatMoney(product.priceInCents)}</strong>
        <AddToCartButton product={{ slug: product.slug, name: product.name, priceInCents: product.priceInCents, imageUrl: product.imageUrl, category: product.category }} max={state.max} disabled={!state.purchasable} />
      </div>
    </div>
  </article>;
}
