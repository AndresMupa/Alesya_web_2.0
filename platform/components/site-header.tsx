"use client";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { BrandLockup } from "@/components/brand-lockup";
import { CartButton } from "@/components/store/cart-button";

/** Encabezado público. El panel administrativo no se enlaza desde aquí: el equipo entra por /admin. */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return <header className="site-header"><div className="header-inner page-width">
    <BrandLockup />
    <button className="mobile-menu" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="main-navigation" aria-label={open ? "Cerrar menú" : "Abrir menú"}>{open ? <X /> : <Menu />}</button>
    <nav id="main-navigation" className={open ? "main-nav is-open" : "main-nav"} aria-label="Navegación principal" onClick={() => setOpen(false)}>
      <Link href="/#explorar">Explora</Link><Link href="/proyectos">Proyectos</Link><Link href="/catalogo">Tienda</Link><Link href="/colegios">Colegios</Link><Link href="/#clientes">Comunidad</Link>
    </nav>
    <div className="header-actions"><CartButton /></div>
  </div></header>;
}
