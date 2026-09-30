import Link from "next/link";
import { ArrowRight, PackageOpen, Search } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ProductCard } from "@/components/store/product-card";
import { listStoreCategories, listStoreProducts, type StoreProduct } from "@/lib/commerce/catalog";
import { categoryMeta } from "@/lib/content";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tienda educativa | Alesya X-Tech", description: "Kits de robótica, Arduino, sensores, impresión 3D, bricolaje y libros para aprender construyendo." };

async function load(category?: string, search?: string): Promise<{ products: StoreProduct[]; categories: string[] } | null> {
  try {
    const [products, categories] = await Promise.all([listStoreProducts({ category, search }), listStoreCategories()]);
    return { products, categories };
  } catch (error) { console.error("store_catalog_failed", error); return null; }
}

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ categoria?: string; q?: string }> }) {
  const { categoria, q } = await searchParams;
  const category = categoria?.slice(0, 80) || undefined;
  const search = q?.trim().slice(0, 80) || undefined;
  const data = await load(category, search);
  const link = (value?: string) => { const params = new URLSearchParams({ ...(value && { categoria: value }), ...(search && { q: search }) }); return `/catalogo${params.size ? `?${params}` : ""}#productos`; };

  return <div className="site-shell"><div className="interior-header"><SiteHeader /></div><main>
    <section className="page-hero"><div className="page-width"><p className="eyebrow eyebrow-light">Tienda educativa</p><h1>Herramientas para<br />ideas grandes.</h1><p>Kits, componentes, libros y experiencias organizados por su uso pedagógico.</p></div></section>
    {data && data.categories.length > 0 && <section className="section page-width"><div className="category-grid">{data.categories.map((title, index) => { const { icon: Icon, detail } = categoryMeta(title); return <Link href={link(title)} className="category-card" key={title}><span className="category-number">{String(index + 1).padStart(2, "0")}</span><Icon size={29} /><h3>{title}</h3><p>{detail}</p><span className="round-arrow"><ArrowRight size={17} /></span></Link>; })}</div></section>}
    <section className="commerce-section" id="productos"><div className="page-width">
      <div className="section-heading split-heading"><div><p className="eyebrow">{category ?? "Selección Alesya"}</p><h2>{category ? `${category}.` : "Productos con ruta pedagógica."}</h2></div>
        <form className="store-search" action="/catalogo" method="get">{category && <input type="hidden" name="categoria" value={category} />}<Search size={18} /><input name="q" defaultValue={search} placeholder="Buscar sensores, kits, libros…" aria-label="Buscar productos" maxLength={80} /><button type="submit">Buscar</button></form>
      </div>
      {data && data.categories.length > 1 && <nav className="filter-strip" aria-label="Filtrar por categoría"><Link href={link()} className={!category ? "filter-chip is-active" : "filter-chip"}>Todo</Link>{data.categories.map((item) => <Link key={item} href={link(item)} className={item === category ? "filter-chip is-active" : "filter-chip"} aria-current={item === category ? "page" : undefined}>{item}</Link>)}</nav>}
      {!data ? <div className="checkout-status">La tienda no está disponible en este momento. Intenta de nuevo en unos minutos.</div>
        : data.products.length ? <div className="product-grid">{data.products.map((product) => <ProductCard key={product.slug} product={product} />)}</div>
        : <div className="store-empty"><PackageOpen size={42} strokeWidth={1.2} /><h3>{search ? `Sin resultados para “${search}”` : "Pronto habrá productos aquí"}</h3><p>{search || category ? <Link href="/catalogo#productos" className="underlined-link">Ver todo el catálogo</Link> : "Estamos preparando el catálogo. Escríbenos si buscas algo en particular."}</p></div>}
    </div></section>
  </main><SiteFooter /></div>;
}
