"use client";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BrandLockup } from "@/components/brand-lockup";
import { CartButton } from "@/components/store/cart-button";

/** Encabezado público. El panel administrativo no se enlaza desde aquí: el equipo entra por /admin. */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [scrolled, setScrolled] = useState(false);

  // Solo cambia la clase al cruzar el umbral, así que React no vuelve a pintar en cada evento de scroll.
  useEffect(() => {
    const sync = () => setScrolled(window.scrollY > 40);
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    return () => window.removeEventListener("scroll", sync);
  }, []);

  return <header className={scrolled ? "site-header is-scrolled" : "site-header"}><div className="header-inner page-width">
    <BrandLockup />
    <button ref={menuButton} className="mobile-menu" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="main-navigation" aria-label={open ? "Cerrar menú" : "Abrir menú"}>{open ? <X /> : <Menu />}</button>
    <nav id="main-navigation" className={open ? "main-nav is-open" : "main-nav"} aria-label="Navegación principal" onClick={() => setOpen(false)} onKeyDown={(event) => {
      if (open && event.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
    }}>
      <Link href="/#explorar">Explora</Link><Link href="/proyectos">Proyectos</Link><Link href="/ingles">Inglés</Link><Link href="/catalogo">Tienda</Link><Link href="/colegios">Colegios</Link><Link href="/#servicios">Servicios</Link><Link href="/#clientes">Comunidad</Link>
    </nav>
    <div className="header-actions"><CartButton /></div>
  </div></header>;
}
