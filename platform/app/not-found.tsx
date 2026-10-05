import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Página no encontrada" };

/** 404 con marca: ofrece buscar en la tienda y los caminos principales en vez de un callejón sin salida. */
export default function NotFound() {
  return <div className="site-shell"><div className="interior-header is-solid"><SiteHeader /></div>
    <main className="status-page page-width">
      <p className="eyebrow">Error 404</p>
      <h1>Esta página no existe <em>o cambió de lugar.</em></h1>
      <p>Puede que el enlace sea antiguo o tenga un error. Busca en la tienda o sigue por uno de estos caminos.</p>
      <form className="store-search" action="/catalogo" method="get"><Search size={18} /><input name="q" placeholder="Buscar sensores, kits, libros…" aria-label="Buscar productos" maxLength={80} /><button type="submit">Buscar</button></form>
      <nav className="status-links" aria-label="Caminos principales">
        <Link href="/">Inicio <ArrowRight size={16} /></Link>
        <Link href="/catalogo">Tienda <ArrowRight size={16} /></Link>
        <Link href="/proyectos">Proyectos <ArrowRight size={16} /></Link>
        <Link href="/colegios">Programas para colegios <ArrowRight size={16} /></Link>
      </nav>
    </main>
    <SiteFooter />
  </div>;
}
