import Link from "next/link";
import { ArrowRight, MessageCircle, PackageOpen, Search, ShieldCheck, Truck } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ProductCard } from "@/components/store/product-card";
import { listStoreCategories, listStoreProducts, storeSorts, type StoreProduct } from "@/lib/commerce/catalog";
import { resolveCategory } from "@/lib/commerce/constants";
import { categoryMeta } from "@/lib/content";
import { plural } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";
import { storeConfig } from "@/lib/settings";

export const dynamic = "force-dynamic";

type Params = { categoria?: string; q?: string; orden?: string };

/** Cada categoría es una página indexable con su canónica; las búsquedas no se indexan y el orden no cambia la canónica. */
export async function generateMetadata({ searchParams }: { searchParams: Promise<Params> }) {
  const { categoria, q } = await searchParams;
  const category = resolveCategory(categoria?.slice(0, 80) || undefined);
  const detail = category ? categoryMeta(category).detail : "";
  return pageMetadata({
    title: category ? `${category}: tienda educativa` : "Tienda de robótica educativa, Arduino e impresión 3D",
    description: category ? `${detail} Compra en línea con pago seguro y envíos a toda Colombia.` : "Kits de robótica LEGO, Arduino, sensores, impresión 3D, bricolaje y libros para aprender construyendo. Pago seguro y envíos a toda Colombia.",
    path: category ? `/catalogo?categoria=${encodeURIComponent(category)}` : "/catalogo",
    noindex: Boolean(q?.trim()),
  });
}

type Category = { category: string; total: number };

async function load(category?: string, search?: string, sort?: string): Promise<{ products: StoreProduct[]; categories: Category[] } | null> {
  try {
    const [products, categories] = await Promise.all([listStoreProducts({ category, search, sort }), listStoreCategories()]);
    return { products, categories };
  } catch (error) { console.error("store_catalog_failed", error); return null; }
}

export default async function CatalogPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { categoria, q, orden } = await searchParams;
  const category = resolveCategory(categoria?.slice(0, 80) || undefined);
  const search = q?.trim().slice(0, 80) || undefined;
  const sort = storeSorts.some((item) => item.value === orden) ? orden! : "relevancia";
  const [data, config] = await Promise.all([load(category, search, sort), storeConfig().catch(() => null)]);
  const link = (patch: { categoria?: string; orden?: string }) => {
    const params = new URLSearchParams();
    const nextCategory = patch.categoria !== undefined ? patch.categoria : category ?? "";
    const nextSort = patch.orden ?? sort;
    if (nextCategory) params.set("categoria", nextCategory);
    if (search) params.set("q", search);
    if (nextSort !== "relevancia") params.set("orden", nextSort);
    return `/catalogo${params.size ? `?${params}` : ""}#productos`;
  };
  const totalSellable = data?.categories.reduce((acc, item) => acc + item.total, 0) ?? 0;
  const whatsapp = `https://wa.me/${config?.whatsappDigits ?? "573005937840"}?text=${encodeURIComponent("Hola, quiero asesoría para elegir productos de la tienda Alesya.")}`;

  return <div className="site-shell"><div className="interior-header"><SiteHeader /></div><main>
    <section className="page-hero store-hero"><div className="page-width">
      <p className="eyebrow eyebrow-light">Tienda educativa</p>
      <h1>Herramientas para<br />ideas grandes.</h1>
      <p>Kits, componentes, libros y experiencias organizados por su uso pedagógico. {totalSellable ? `${plural(totalSellable, "producto disponible", "productos disponibles")}.` : ""}</p>
      <form className="store-search store-search-hero" action="/catalogo" method="get">{category && <input type="hidden" name="categoria" value={category} />}<Search size={18} /><input name="q" defaultValue={search} placeholder="Buscar sensores, kits, libros…" aria-label="Buscar productos" maxLength={80} /><button type="submit">Buscar</button></form>
    </div></section>
    <div className="store-trust page-width" aria-label="Garantías de compra">
      <span><ShieldCheck size={18} /> Pago seguro con Wompi o transferencia confirmada</span>
      <span><Truck size={18} /> {config?.shippingNote ?? "Envíos a toda Colombia"}</span>
      <a href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} /> Asesoría por WhatsApp</a>
    </div>
    {data && data.categories.length > 0 && <section className="section page-width store-categories"><div className="category-grid">{data.categories.map(({ category: title, total }, index) => { const { icon: Icon, detail, tone } = categoryMeta(title); return <Link href={link({ categoria: title })} className={`category-card${title === category ? " is-active" : ""}`} data-tone={tone} key={title}><span className="category-number">{String(index + 1).padStart(2, "0")}</span><Icon size={29} /><h3>{title}</h3><p>{detail}</p><small className="store-count">{plural(total, "producto", "productos")}</small><span className="round-arrow"><ArrowRight size={17} /></span></Link>; })}</div></section>}
    <section className="commerce-section" id="productos"><div className="page-width">
      <div className="section-heading split-heading"><div><p className="eyebrow">{category ?? "Selección Alesya"}</p><h2>{category ? `${category}.` : "Productos con ruta pedagógica."}</h2></div>
        <form className="store-sort" action="/catalogo" method="get" aria-label="Ordenar">{category && <input type="hidden" name="categoria" value={category} />}{search && <input type="hidden" name="q" value={search} />}<label>Ordenar por<select name="orden" defaultValue={sort}>{storeSorts.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><button type="submit" className="refresh-button">Aplicar</button></form>
      </div>
      {data && data.categories.length > 1 && <nav className="filter-strip" aria-label="Filtrar por categoría"><Link href={link({ categoria: "" })} className={!category ? "filter-chip is-active" : "filter-chip"}>Todo <b>{totalSellable}</b></Link>{data.categories.map((item) => <Link key={item.category} href={link({ categoria: item.category })} className={item.category === category ? "filter-chip is-active" : "filter-chip"} aria-current={item.category === category ? "page" : undefined}>{item.category} <b>{item.total}</b></Link>)}</nav>}
      {!data ? <div className="checkout-status">La tienda no está disponible en este momento. Intenta de nuevo en unos minutos.</div>
        : data.products.length ? <><p className="store-results">{plural(data.products.length, "producto", "productos")}{search ? ` para “${search}”` : ""}{category ? ` en ${category}` : ""}</p><div className="product-grid">{data.products.map((product) => <ProductCard key={product.slug} product={product} />)}</div></>
        : <div className="store-empty"><PackageOpen size={42} strokeWidth={1.2} /><h3>{search ? `Sin resultados para “${search}”` : "Pronto habrá productos aquí"}</h3><p>{search || category ? <Link href="/catalogo#productos" className="underlined-link">Ver todo el catálogo</Link> : "Estamos preparando el catálogo. Escríbenos si buscas algo en particular."}</p></div>}
    </div></section>
  </main><SiteFooter /></div>;
}
