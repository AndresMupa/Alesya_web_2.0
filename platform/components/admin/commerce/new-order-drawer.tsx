"use client";
/* eslint-disable @next/next/no-img-element -- fotos pequeñas del catálogo, servidas tal cual. */

import { FormEvent, useMemo, useState } from "react";
import { Minus, PackageOpen, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Drawer, send, useJson } from "@/components/admin/kit";
import type { AdminProduct } from "@/components/admin/commerce/product-drawer";
import { formatMoney } from "@/lib/format";

type Line = { slug: string; name: string; sku: string; priceInCents: number; stock: number; backorder: boolean; quantity: number };

/**
 * Pedido registrado desde el panel (venta por WhatsApp, colegio o feria): productos del catálogo con precio,
 * datos del cliente y envío. Queda pendiente de pago para enviar el enlace de Wompi o registrar el pago.
 */
export function NewOrderDrawer({ open, asesor, onClose, onCreated }: { open: boolean; asesor: string; onClose: () => void; onCreated: (id: string, checkoutUrl: string | null) => void }) {
  const { data } = useJson<{ products: AdminProduct[] }>(open ? "/api/admin/commerce/products" : null);
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [shippingCop, setShippingCop] = useState("0");
  const [saving, setSaving] = useState(false);
  const term = search.trim().toLowerCase();
  const sellable = useMemo(() => (data?.products ?? []).filter((product) => product.status === "active" && product.priceInCents > 0), [data]);
  const matches = term.length >= 2 ? sellable.filter((product) => `${product.name} ${product.sku}`.toLowerCase().includes(term)).slice(0, 8) : [];
  const subtotal = lines.reduce((acc, line) => acc + line.priceInCents * line.quantity, 0);
  const total = subtotal + (Math.max(0, Math.round(Number(shippingCop)) || 0)) * 100;

  function add(product: AdminProduct) {
    setLines((current) => current.some((line) => line.slug === product.slug)
      ? current.map((line) => line.slug === product.slug ? { ...line, quantity: Math.min(99, line.quantity + 1) } : line)
      : [...current, { slug: product.slug, name: product.name, sku: product.sku, priceInCents: product.priceInCents, stock: product.stock, backorder: product.backorder, quantity: 1 }]);
    setSearch("");
  }
  const setQuantity = (slug: string, quantity: number) => setLines((current) => quantity <= 0 ? current.filter((line) => line.slug !== slug) : current.map((line) => line.slug === slug ? { ...line, quantity: Math.min(99, quantity) } : line));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lines.length) { toast.error("Agrega al menos un producto."); return; }
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();
    setSaving(true);
    const result = await send<{ id: string; reference: string; checkoutUrl: string | null }>("/api/admin/commerce/orders", "POST", {
      items: lines.map(({ slug, quantity }) => ({ slug, quantity })),
      customer: { name: text("name"), email: text("email"), phone: text("phone"), document: text("document"), city: text("city"), address: text("address") || "Por coordinar", notes: text("notes") },
      shippingCop: Math.max(0, Math.round(Number(shippingCop)) || 0), internalNotes: text("internalNotes"), sendEmail: form.get("sendEmail") === "on", ...(asesor && { asesor }),
    });
    setSaving(false);
    if (result) { toast.success(`Pedido ${result.reference} registrado.`); setLines([]); setShippingCop("0"); onCreated(result.id, result.checkoutUrl); }
  }

  return <Drawer open={open} onClose={onClose} title="Nuevo pedido" subtitle="Venta por WhatsApp, colegio o feria. Queda pendiente de pago.">
    <form className="adm-card adm-form" onSubmit={submit}>
      <h3>Productos</h3>
      <label className="adm-search-line"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre o SKU (solo publicados con precio)" aria-label="Buscar producto" /></label>
      {matches.length > 0 && <ul className="adm-picker">{matches.map((product) => <li key={product.id}><button type="button" onClick={() => add(product)}>
        {product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span className="adm-picker-icon"><PackageOpen size={16} /></span>}
        <span><strong>{product.name}</strong><small>{product.sku} · {product.stock} und{product.backorder ? " · bajo pedido" : ""}</small></span>
        <b>{formatMoney(product.priceInCents)}</b>
      </button></li>)}</ul>}
      {term.length >= 2 && !matches.length && <p className="adm-muted">Sin resultados. Solo aparecen productos publicados con precio.</p>}
      {lines.length ? <ul className="adm-lines">{lines.map((line) => <li key={line.slug}>
        <span><strong>{line.name}</strong><small>{formatMoney(line.priceInCents)} c/u{!line.backorder && line.quantity > line.stock && <em> · supera el stock ({line.stock})</em>}</small></span>
        <div className="store-qty" role="group" aria-label={`Cantidad de ${line.name}`}><button type="button" onClick={() => setQuantity(line.slug, line.quantity - 1)} aria-label="Menos"><Minus size={13} /></button><input value={line.quantity} inputMode="numeric" aria-label="Cantidad" onChange={(event) => setQuantity(line.slug, Number(event.target.value.replace(/\D/g, "")) || 1)} /><button type="button" onClick={() => setQuantity(line.slug, line.quantity + 1)} aria-label="Más"><Plus size={13} /></button></div>
        <b>{formatMoney(line.priceInCents * line.quantity)}</b>
        <button type="button" className="store-remove" onClick={() => setQuantity(line.slug, 0)} aria-label={`Quitar ${line.name}`}><Trash2 size={14} /></button>
      </li>)}</ul> : <p className="adm-muted">Busca y agrega productos.</p>}
      <div className="adm-form-grid">
        <label>Envío (COP)<input type="number" min="0" step="1000" value={shippingCop} onChange={(event) => setShippingCop(event.target.value)} /></label>
        <div className="adm-totals adm-totals-inline"><span>Subtotal</span><b>{formatMoney(subtotal)}</b><span>Total</span><strong>{formatMoney(total)}</strong></div>
      </div>

      <h3>Cliente</h3>
      <div className="adm-form-grid">
        <label>Nombre<input name="name" required minLength={2} maxLength={120} /></label>
        <label>Correo<input name="email" type="email" required maxLength={180} /></label>
        <label>Celular<input name="phone" required minLength={7} maxLength={30} /></label>
        <label>Cédula o NIT<input name="document" maxLength={30} /></label>
        <label>Ciudad<input name="city" required minLength={2} maxLength={100} /></label>
        <label>Dirección<input name="address" maxLength={240} placeholder="Por coordinar" /></label>
      </div>
      <label>Indicaciones del cliente<input name="notes" maxLength={1000} /></label>
      <label>Nota interna<textarea name="internalNotes" rows={2} maxLength={4000} placeholder="Colegio, acuerdo de pago, quién atendió…" /></label>
      <label className="adm-check"><input type="checkbox" name="sendEmail" defaultChecked /> Enviar al cliente el resumen por correo (con enlace de pago si Wompi está activo)</label>
      <button className="button button-dark" type="submit" disabled={saving || !lines.length}>{saving ? "Registrando…" : `Registrar pedido por ${formatMoney(total)}`}</button>
    </form>
  </Drawer>;
}
