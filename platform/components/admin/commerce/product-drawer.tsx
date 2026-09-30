"use client";
/* eslint-disable @next/next/no-img-element -- fotos de /media y /uploads servidas tal cual (en cPanel no hay optimizador de imágenes). */

import { FormEvent, useRef, useState } from "react";
import { ImagePlus, PackageOpen } from "lucide-react";
import { toast } from "sonner";
import { Drawer, send, useJson } from "@/components/admin/kit";
import { inventoryReasons, productStatuses } from "@/lib/commerce/constants";
import { formatDateTime } from "@/lib/format";

export type AdminProduct = { id: string; slug: string; sku: string; name: string; description: string; category: string; priceInCents: number; stock: number; status: string; imageUrl: string | null; position: number; featured: boolean; backorder: boolean };
type History = { events: { id: string; quantityDelta: number; reason: string; createdAt: string; orderReference: string | null }[] };

const adjustReasons = ["restock", "adjustment", "damage", "return", "stock_count"] as const;

/** Crear o editar un producto: datos, foto, publicación y, al editar, ajustes e historial de inventario. */
export function ProductDrawer({ product, createIn, categories, onClose, onSaved }: { product: AdminProduct | null; createIn: string | null; categories: string[]; onClose: () => void; onSaved: () => void }) {
  const open = !!product || createIn !== null;
  return <Drawer open={open} onClose={onClose} title={product ? product.name : "Nuevo producto"} subtitle={product ? `SKU ${product.sku}` : createIn ? `Categoría ${createIn}` : undefined}>
    {open && <ProductForm key={product?.id ?? `new-${createIn}`} product={product} createIn={createIn} categories={categories} onSaved={onSaved} onClose={onClose} />}
    {product && <InventoryPanel key={`inv-${product.id}`} product={product} onSaved={onSaved} />}
  </Drawer>;
}

function ProductForm({ product, createIn, categories, onSaved, onClose }: { product: AdminProduct | null; createIn: string | null; categories: string[]; onSaved: () => void; onClose: () => void }) {
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? "");
  const [category, setCategory] = useState(product?.category ?? createIn ?? categories[0] ?? "Electrónica");
  const [customCategory, setCustomCategory] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
    try {
      const body = new FormData(); body.set("file", file);
      const response = await fetch("/api/admin/commerce/uploads", { method: "POST", body });
      const result = await response.json().catch(() => ({})) as { url?: string; message?: string };
      if (response.ok && result.url) { setImageUrl(result.url); toast.success("Foto cargada. Guarda para aplicarla."); }
      else toast.error(result.message ?? "No se pudo subir la foto.");
    } catch { toast.error("No se pudo subir la foto."); }
    finally { setUploading(false); if (fileInput.current) fileInput.current.value = ""; }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();
    const values = {
      name: text("name"), sku: text("sku"), category: text("category"), description: text("description"), price: Math.max(0, Math.round(Number(text("price")) || 0)),
      imageUrl: imageUrl.trim() || null, status: text("status"), featured: form.get("featured") === "on", backorder: form.get("backorder") === "on",
    };
    setSaving(true);
    const result = product
      ? await send("/api/admin/commerce/products", "PATCH", { id: product.id, ...values }, "Producto actualizado.")
      : await send("/api/admin/commerce/products", "POST", { ...values, stock: Math.max(0, Math.round(Number(text("stock")) || 0)) }, "Producto creado.");
    setSaving(false);
    if (result) { onSaved(); if (!product) onClose(); }
  }

  return <form className="adm-card adm-form adm-product-form" onSubmit={submit}>
    <div className="adm-product-image">
      <div className="adm-product-preview">{imageUrl ? <img src={imageUrl} alt="" /> : <PackageOpen size={34} strokeWidth={1.2} />}</div>
      <div>
        <button type="button" className="refresh-button" onClick={() => fileInput.current?.click()} disabled={uploading}><ImagePlus size={15} /> {uploading ? "Subiendo…" : "Subir foto"}</button>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
        <label>o ruta / URL<input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="/media/productos/foto.jpg" maxLength={500} /></label>
        {imageUrl && <button type="button" className="adm-link-button" onClick={() => setImageUrl("")}>Quitar foto</button>}
      </div>
    </div>
    <div className="adm-form-grid">
      <label className="adm-span-2">Nombre<input name="name" defaultValue={product?.name} required minLength={3} maxLength={160} /></label>
      <label>SKU<input name="sku" defaultValue={product?.sku} required minLength={2} maxLength={50} /></label>
      <label>Precio COP<input name="price" type="number" min="0" step="100" defaultValue={product ? Math.round(product.priceInCents / 100) || "" : ""} placeholder="0 = sin precio" /></label>
      <label>Categoría{customCategory
        ? <input name="category" value={category} onChange={(event) => setCategory(event.target.value)} required minLength={2} maxLength={80} placeholder="Nueva categoría" />
        : <select name="category" value={category} onChange={(event) => { if (event.target.value === "__new") { setCustomCategory(true); setCategory(""); } else setCategory(event.target.value); }}>{Array.from(new Set([...categories, category])).filter(Boolean).map((item) => <option key={item} value={item}>{item}</option>)}<option value="__new">+ Nueva categoría…</option></select>}
      </label>
      <label>Estado<select name="status" defaultValue={product?.status ?? "active"}>{productStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
      {!product && <label>Stock inicial<input name="stock" type="number" min="0" step="1" defaultValue={0} /></label>}
    </div>
    <label>Descripción<textarea name="description" defaultValue={product?.description ?? ""} rows={3} required minLength={5} maxLength={1000} /></label>
    <div className="adm-checks">
      <label><input type="checkbox" name="featured" defaultChecked={product?.featured} /> Destacado en la portada</label>
      <label><input type="checkbox" name="backorder" defaultChecked={product?.backorder} /> Vender bajo pedido cuando no haya stock</label>
    </div>
    <p className="adm-hint">Sin precio el producto queda en borrador: la tienda solo muestra productos publicados con precio.</p>
    <button className="button button-dark" type="submit" disabled={saving || uploading}>{product ? "Guardar cambios" : "Crear producto"}</button>
  </form>;
}

function InventoryPanel({ product, onSaved }: { product: AdminProduct; onSaved: () => void }) {
  const [revision, setRevision] = useState(0);
  const { data } = useJson<History>(`/api/admin/commerce/products/${product.id}/inventory`, revision);
  const [saving, setSaving] = useState(false);
  const [stock, setStock] = useState(product.stock);

  async function adjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const reason = String(data.get("reason"));
    const value = Math.trunc(Number(data.get("quantity")));
    if (!Number.isFinite(value)) return;
    // "Conteo físico" recibe el total contado; el resto, la cantidad a sumar o restar.
    const delta = reason === "stock_count" ? value - stock : value;
    if (!delta) { toast.info("El stock ya es ese."); return; }
    setSaving(true);
    const result = await send(`/api/admin/commerce/products/${product.id}/inventory`, "POST", { delta, reason }, "Inventario actualizado.");
    setSaving(false);
    if (result) { setStock(stock + delta); form.reset(); setRevision((current) => current + 1); onSaved(); }
  }

  return <section className="adm-card">
    <h3>Inventario · {stock} und</h3>
    <form className="adm-stock-form" onSubmit={adjust}>
      <select name="reason" defaultValue="restock" aria-label="Motivo">{adjustReasons.map((reason) => <option key={reason} value={reason}>{inventoryReasons[reason]}</option>)}</select>
      <input name="quantity" type="number" step="1" required placeholder="+5 / -2 / total contado" aria-label="Cantidad" />
      <button className="refresh-button" type="submit" disabled={saving}>Aplicar</button>
    </form>
    {data?.events.length ? <ul className="adm-plain-list adm-history">{data.events.map((event) => <li key={event.id}>
      <span>{inventoryReasons[event.reason] ?? event.reason}{event.orderReference && <small>{event.orderReference}</small>}</span>
      <time>{formatDateTime(event.createdAt)}</time>
      <strong className={event.quantityDelta < 0 ? "is-negative" : "is-positive"}>{event.quantityDelta > 0 ? "+" : ""}{event.quantityDelta}</strong>
    </li>)}</ul> : <p className="adm-muted">Sin movimientos.</p>}
  </section>;
}
