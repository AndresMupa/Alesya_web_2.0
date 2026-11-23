import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";
import { legalPages } from "@/lib/legal";
import { site } from "@/lib/site";

/** Pie público: navegación, contacto con dirección (útil para búsquedas locales) y políticas legales. */
export function SiteFooter() {
  return <footer className="site-footer">
    <div className="page-width footer-grid">
      <div><BrandLockup /><p>Alesya Ediciones publica libros y ofrece servicios educativos en Colombia. Alesya X-Tech es su línea de tecnología educativa.</p><Link href="/#servicios">Todos los servicios de Alesya</Link></div>
      <div><b>Explora</b><Link href="/robotica-educativa">Guía de robótica educativa</Link><Link href="/proyectos">Proyectos</Link><Link href="/catalogo">Tienda</Link><Link href="/pedido">Rastrear pedido</Link><Link href="/colegios">Colegios</Link><Link href="/plan-lector">Plan lector</Link><Link href="/preguntas-frecuentes">Preguntas frecuentes</Link><Link href="/#clientes">Clientes</Link></div>
      <div><b>Tecnologías</b><Link href="/catalogo?categoria=Rob%C3%B3tica">TECH-R3 y MART-02</Link><Link href="/catalogo?categoria=Electr%C3%B3nica">Arduino y sensores</Link><Link href="/catalogo?categoria=Impresi%C3%B3n%203D">Impresión 3D</Link><Link href="/catalogo?categoria=Libros">Libros</Link></div>
      <div><b>Contacto</b><a href={`mailto:${site.email}`}>{site.email}</a><a href={site.phoneHref}>{site.phone}</a><a href={site.instagram} target="_blank" rel="noopener noreferrer">Instagram @alesya0108</a><address>{site.address.street}<br />{site.address.city}, {site.address.region}</address></div>
    </div>
    <div className="page-width footer-bottom">
      <span>© {new Date().getFullYear()} {site.publisher} · {site.name}</span>
      <nav aria-label="Información legal">{legalPages.map((page) => <Link key={page.slug} href={`/${page.slug}`}>{page.short}</Link>)}</nav>
    </div>
  </footer>;
}
