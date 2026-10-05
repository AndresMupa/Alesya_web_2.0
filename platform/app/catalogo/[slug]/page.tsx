import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle, ShieldCheck, Truck } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { AddToCartPanel } from "@/components/store/add-to-cart";
import { ProductCard, ProductVisual } from "@/components/store/product-card";
import { getRelatedProducts, getStoreProduct, type StoreProduct } from "@/lib/commerce/catalog";
import { stockState } from "@/lib/commerce/constants";
import { categoryMeta } from "@/lib/content";
import { formatMoney } from "@/lib/format";
import { pageMetadata, summarize } from "@/lib/seo";
import { storeConfig } from "@/lib/settings";
import { absoluteUrl, jsonLd, site, siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  try { return await getStoreProduct(slug); } catch (error) { console.error("store_product_failed", error); return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const product = await load((await params).slug);
  if (!product) return { title: "Producto no disponible", robots: { index: false, follow: true } };
  return pageMetadata({
    title: `${product.name} · ${product.category}`,
    description: summarize(`${product.description} Compra en línea con pago seguro y envíos a toda Colombia.`),
    path: `/catalogo/${product.slug}`,
    image: product.imageUrl ? { url: product.imageUrl, alt: product.name } : null,
  });
}

/** Datos estructurados para Google: ficha de producto con precio y disponibilidad, y la ruta Tienda › Categoría › Producto. */
function productJsonLd(product: StoreProduct, purchasable: boolean) {
  const url = absoluteUrl(`/catalogo/${product.slug}`);
  return jsonLd([
    {
      "@context": "https://schema.org", "@type": "Product", name: product.name, description: product.description, sku: product.slug, category: product.category, url,
      ...(product.imageUrl && { image: absoluteUrl(product.imageUrl) }),
      brand: { "@type": "Brand", name: site.name },
      offers: { "@type": "Offer", url, priceCurrency: "COP", price: Math.round(product.priceInCents / 100), availability: purchasable ? (product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/PreOrder") : "https://schema.org/OutOfStock", itemCondition: /usad/i.test(product.name) ? "https://schema.org/UsedCondition" : "https://schema.org/NewCondition", seller: { "@id": `${siteUrl()}/#organizacion` } },
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Tienda", item: absoluteUrl("/catalogo") },
        { "@type": "ListItem", position: 2, name: product.category, item: absoluteUrl(`/catalogo?categoria=${encodeURIComponent(product.category)}`) },
        { "@type": "ListItem", position: 3, name: product.name, item: url },
      ],
    },
  ]);
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const product = await load((await params).slug);
  if (!product) notFound();
  const [related, config] = await Promise.all([getRelatedProducts(product).catch(() => []), storeConfig().catch(() => null)]);
  const state = stockState(product);
  const { tone } = categoryMeta(product.category);
  const whatsapp = (text: string) => `https://wa.me/${config?.whatsappDigits ?? "573005937840"}?text=${encodeURIComponent(text)}`;

  return <div className="site-shell"><div className="interior-header is-solid"><SiteHeader /></div><main className="store-product-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: productJsonLd(product, state.purchasable) }} />
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
          {state.purchasable
            ? <AddToCartPanel product={{ slug: product.slug, name: product.name, priceInCents: product.priceInCents, imageUrl: product.imageUrl, category: product.category }} max={state.max} disabled={false} />
            : <div className="store-buy"><p className="store-soldout">Agotado por ahora.</p><a className="button button-dark" href={whatsapp(`Hola, quiero que me avisen cuando vuelva a estar disponible: ${product.name}.`)} target="_blank" rel="noopener noreferrer"><MessageCircle size={17} /> Avísame cuando llegue</a></div>}
          <ul className="store-assurances">
            <li><ShieldCheck size={18} /> Pago seguro con Wompi o transferencia confirmada por el equipo.</li>
            <li><Truck size={18} /> {config?.shippingNote ?? "Envíos a toda Colombia; coordinamos la entrega al confirmar el pago."}</li>
            <li><MessageCircle size={18} /> ¿Compras para un colegio? <a href={whatsapp(`Hola, quiero una cotización para colegio de ${product.name}.`)} target="_blank" rel="noopener noreferrer">Pide una cotización por WhatsApp</a>.</li>
          </ul>
        </div>
      </section>
      {related.length > 0 && <section className="section"><div className="section-heading"><p className="eyebrow">También en {product.category}</p><h2>Complementa tu proyecto.</h2></div><div className="product-grid">{related.map((item) => <ProductCard key={item.slug} product={item} />)}</div></section>}
    </div>
  </main><SiteFooter /></div>;
}
