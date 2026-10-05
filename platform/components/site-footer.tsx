import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";
import { legalPages } from "@/lib/legal";
import { site } from "@/lib/site";

/** Pie público: navegación, contacto con dirección (útil para búsquedas locales) y políticas legales. */
export function SiteFooter() {
  return <footer className="site-footer">
    <div className="page-width footer-grid">
      <div><BrandLockup /><p>Alesya Ediciones impulsa Alesya X-Tech: educación maker hecha en Colombia.</p></div>
      <div><b>Explora</b><Link href="/proyectos">Proyectos</Link><Link href="/catalogo">Tienda</Link><Link href="/pedido">Rastrear pedido</Link><Link href="/colegios">Colegios</Link><Link href="/#clientes">Clientes</Link></div>
      <div><b>Tecnologías</b><Link href="/catalogo?categoria=Rob%C3%B3tica">LEGO EV3 y WeDo</Link><Link href="/catalogo?categoria=Electr%C3%B3nica">Arduino y sensores</Link><Link href="/catalogo?categoria=Impresi%C3%B3n%203D">Impresión 3D</Link><Link href="/catalogo?categoria=Libros">Libros</Link></div>
      <div><b>Contacto</b><a href={`mailto:${site.email}`}>{site.email}</a><a href={site.phoneHref}>{site.phone}</a><address>{site.address.street}<br />{site.address.city}, {site.address.region}</address></div>
    </div>
    <div className="page-width footer-bottom">
      <span>© {new Date().getFullYear()} {site.publisher} · {site.name}</span>
      <nav aria-label="Información legal">{legalPages.map((page) => <Link key={page.slug} href={`/${page.slug}`}>{page.short}</Link>)}</nav>
    </div>
  </footer>;
}
