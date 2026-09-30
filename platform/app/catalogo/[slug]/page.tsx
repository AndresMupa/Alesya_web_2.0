import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle, ShieldCheck, Truck } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { AddToCartPanel } from "@/components/store/add-to-cart";
import { ProductCard, ProductVisual } from "@/components/store/product-card";
import { getRelatedProducts, getStoreProduct } from "@/lib/commerce/catalog";
import { stockState } from "@/lib/commerce/constants";
import { categoryMeta } from "@/lib/content";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  try { return await getStoreProduct(slug); } catch (error) { console.error("store_product_failed", error); return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const product = await load((await params).slug);
  return product ? { title: `${product.name} | Tienda Alesya`, description: product.description.slice(0, 160) } : { title: "Producto no disponible | Alesya" };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const product = await load((await params).slug);
  if (!product) notFound();
  const related = await getRelatedProducts(product).catch(() => []);
  const state = stockState(product);
  const { tone } = categoryMeta(product.category);
  const whatsapp = `https://wa.me/573005937840?text=${encodeURIComponent(`Hola, quiero información sobre ${product.name}.`)}`;

  return <div className="site-shell"><div className="interior-header is-solid"><SiteHeader /></div><main className="store-product-page">
    <div className="page-width">
      <nav className="store-breadcrumb" aria-label="Ruta"><Link href="/catalogo">Tienda</Link><span>/</span><Link href={`/catalogo?categoria=${encodeURIComponent(product.category)}#productos`}>{product.category}</Link><span>/</span><span aria-current="page">{product.name}</span></nav>
      <section className="store-product">
        <div className={`product-visual store-product-visual${product.imageUrl ? " has-image" : ""}`} data-tone={tone}><ProductVisual product={product} size={120} /></div>
        <div className="store-product-info">
          <p className="product-type">{product.category}</p>
          <h1>{product.name}</h1>
          <strong className="store-price">{formatMoney(product.priceInCents)}</strong>
          <p className="store-stock" data-state={state.purchasable ? (state.label === "Disponible" ? "ok" : "low") : "out"}>{state.label}</p>
          <p className="store-description">{product.description}</p>
          <AddToCartPanel product={{ slug: product.slug, name: product.name, priceInCents: product.priceInCents, imageUrl: product.imageUrl, category: product.category }} max={state.max} disabled={!state.purchasable} />
          <ul className="store-assurances">
            <li><ShieldCheck size={18} /> Pago seguro con Wompi o transferencia confirmada por el equipo.</li>
            <li><Truck size={18} /> Envíos a toda Colombia; coordinamos la entrega al confirmar el pago.</li>
            <li><MessageCircle size={18} /> ¿Compras para un colegio? <a href={whatsapp} target="_blank" rel="noopener noreferrer">Pide una cotización por WhatsApp</a>.</li>
          </ul>
        </div>
      </section>
      {related.length > 0 && <section className="section"><div className="section-heading"><p className="eyebrow">También en {product.category}</p><h2>Complementa tu proyecto.</h2></div><div className="product-grid">{related.map((item) => <ProductCard key={item.slug} product={item} />)}</div></section>}
    </div>
  </main><SiteFooter /></div>;
}
