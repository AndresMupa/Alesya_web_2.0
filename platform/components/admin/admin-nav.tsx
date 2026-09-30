"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ContactRound, Kanban, LayoutDashboard, Package, PlugZap, Settings2, ShoppingCart } from "lucide-react";

const sections = [
  { group: "General", items: [{ href: "/admin", label: "Resumen", icon: LayoutDashboard }] },
  { group: "Ventas", items: [{ href: "/admin/ventas", label: "Máquina de ventas", icon: Kanban }, { href: "/admin/crm", label: "CRM · Contactos", icon: ContactRound }] },
  { group: "Tienda", items: [{ href: "/admin/pedidos", label: "Pedidos", icon: ShoppingCart }, { href: "/admin/productos", label: "Productos e inventario", icon: Package }] },
  { group: "Sistema", items: [{ href: "/admin/configuracion", label: "Configuración", icon: Settings2 }, { href: "/admin/integraciones", label: "Integraciones", icon: PlugZap }] },
];

export function AdminNav() {
  const pathname = usePathname();
  return <nav className="admin-nav adm-nav" aria-label="Módulos del panel">
    {sections.map((section) => <div className="adm-nav-group" key={section.group}>
      <span>{section.group}</span>
      {section.items.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={active ? "is-active" : undefined}><Icon />{label}</Link>;
      })}
    </div>)}
  </nav>;
}
