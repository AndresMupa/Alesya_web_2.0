"use client";

import Link from "next/link";
import { ArrowRight, PackageOpen } from "lucide-react";
import { useEffect, useState } from "react";

type Product = { slug: string; name: string; description: string; category: string; priceInCents: number; stock: number };
const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export function ManagedProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/products", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json() as { products?: Product[] };
        if (Array.isArray(data.products)) setProducts(data.products);
      })
      .catch(() => { /* The featured catalog remains available if this request fails. */ });
    return () => controller.abort();
  }, []);
  if (!products.length) return null;
  return <div className="managed-catalog"><div className="section-heading split-heading"><div><p className="eyebrow">Novedades</p><h2>Productos publicados desde administración.</h2></div><p>Estos artículos salen directamente del inventario operativo y están disponibles para compra.</p></div><div className="product-grid">{products.map((product) => <article className="product-card" key={product.slug}><div className="product-visual" data-tone="cyan"><PackageOpen size={76} strokeWidth={1.15} /><span>{product.stock > 0 ? `${product.stock} disponibles` : "Bajo pedido"}</span></div><div className="product-copy"><p className="product-type">{product.category}</p><h3>{product.name}</h3><p>{product.description}</p><div className="product-footer"><strong>{money.format(product.priceInCents / 100)}</strong><Link href={`/checkout?producto=${product.slug}`} aria-label={`Comprar ${product.name}`}><ArrowRight size={19} /></Link></div></div></article>)}</div></div>;
}
