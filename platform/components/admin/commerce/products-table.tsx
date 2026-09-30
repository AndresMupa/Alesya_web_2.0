"use client";
/* eslint-disable @next/next/no-img-element -- fotos de /media y /uploads servidas tal cual (en cPanel no hay optimizador de imágenes). */

import { useState } from "react";
import { PackageOpen, Pencil, Star } from "lucide-react";
import { toast } from "sonner";
import { send } from "@/components/admin/kit";
import type { AdminProduct } from "@/components/admin/commerce/product-drawer";
import { LOW_STOCK, productStatusLabel } from "@/lib/commerce/constants";

type Props = { products: AdminProduct[]; reload: () => void; onEdit: (product: AdminProduct) => void };

const bulkActions = [["publish", "Publicar"], ["draft", "Pasar a borrador"], ["feature", "Destacar"], ["unfeature", "Quitar destacado"], ["archive", "Archivar"]] as const;

/**
 * Vista de hoja de cálculo para poner precios y publicar rápido: el precio se guarda al salir de la
 * celda y la selección permite publicar, destacar o archivar varios productos a la vez.
 */
export function ProductsTable({ products, reload, onEdit }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const visibleIds = products.map((product) => product.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const chosen = visibleIds.filter((id) => selected.has(id));

  function toggle(id: string) { setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }

  async function patch(product: AdminProduct, changes: Record<string, unknown>, message: string) {
    if (await send("/api/admin/commerce/products", "PATCH", { id: product.id, ...changes }, message)) reload();
  }

  async function savePrice(product: AdminProduct, raw: string) {
    const price = Math.max(0, Math.round(Number(raw) || 0));
    if (price * 100 === product.priceInCents) return;
    // Poner el primer precio a un borrador lo publica: es el flujo habitual del inventario importado.
    const publish = product.status === "draft" && product.priceInCents === 0 && price > 0;
    await patch(product, { price, ...(publish && { status: "active" }), ...(price === 0 && product.status === "active" && { status: "draft" }) }, publish ? `${product.name}: precio asignado y publicado.` : `${product.name}: precio actualizado.`);
  }

  async function bulk(action: string) {
    if (!chosen.length) return;
    setBusy(true);
    const result = await send<{ updated: number; skipped: number }>("/api/admin/commerce/products/bulk", "POST", { ids: chosen, action });
    setBusy(false);
    if (result) {
      toast.success(`${result.updated} productos actualizados${result.skipped ? ` · ${result.skipped} sin precio no se publicaron` : ""}.`);
      setSelected(new Set());
      reload();
    }
  }

  return <div className="adm-ptable">
    <div className="adm-bulk" aria-live="polite">
      <span>{chosen.length ? `${chosen.length} seleccionados` : "Selecciona productos para acciones masivas"}</span>
      {bulkActions.map(([action, label]) => <button key={action} type="button" className="refresh-button" disabled={!chosen.length || busy} onClick={() => void bulk(action)}>{label}</button>)}
    </div>
    <div className="sales-table-scroll">
      <table className="admin-table adm-table">
        <thead><tr>
          <th><input type="checkbox" aria-label="Seleccionar todos" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(visibleIds))} /></th>
          <th>Producto</th><th>Categoría</th><th>Precio COP</th><th>Stock</th><th>Estado</th><th>Destacado</th><th>Bajo pedido</th><th />
        </tr></thead>
        <tbody>{products.length ? products.map((product) => <tr key={product.id} className={selected.has(product.id) ? "is-selected" : undefined}>
          <td><input type="checkbox" aria-label={`Seleccionar ${product.name}`} checked={selected.has(product.id)} onChange={() => toggle(product.id)} /></td>
          <td><div className="adm-product-cell">{product.imageUrl ? <img src={product.imageUrl} alt="" loading="lazy" /> : <span><PackageOpen size={18} /></span>}<div><strong>{product.name}</strong><small>{product.sku}</small></div></div></td>
          <td>{product.category}</td>
          <td><input key={product.priceInCents} className="admin-inline-input adm-price-input" type="number" min="0" step="100" defaultValue={Math.round(product.priceInCents / 100) || ""} placeholder="Sin precio" aria-label={`Precio de ${product.name}`}
            onBlur={(event) => void savePrice(product, event.currentTarget.value)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></td>
          <td><span className={product.stock <= LOW_STOCK && !product.backorder ? "is-due" : undefined}>{product.stock}</span></td>
          <td><select className="admin-inline-input" value={product.status} aria-label={`Estado de ${product.name}`} onChange={(event) => void patch(product, { status: event.target.value }, `${product.name}: ${productStatusLabel(event.target.value).toLowerCase()}.`)}>
            <option value="active" disabled={!product.priceInCents}>Publicado</option><option value="draft">Borrador</option><option value="archived">Archivado</option>
          </select></td>
          <td><button type="button" className={`adm-star${product.featured ? " is-on" : ""}`} aria-pressed={product.featured} aria-label={`Destacar ${product.name}`} onClick={() => void patch(product, { featured: !product.featured }, product.featured ? "Ya no es destacado." : "Destacado en la portada.")}><Star size={16} fill={product.featured ? "currentColor" : "none"} /></button></td>
          <td><input type="checkbox" checked={product.backorder} aria-label={`Bajo pedido ${product.name}`} onChange={() => void patch(product, { backorder: !product.backorder }, product.backorder ? "Solo se vende con stock." : "Se vende bajo pedido sin stock.")} /></td>
          <td><button type="button" className="refresh-button" onClick={() => onEdit(product)}><Pencil size={14} /> Editar</button></td>
        </tr>) : <tr><td colSpan={9}>No hay productos con estos filtros.</td></tr>}</tbody>
      </table>
    </div>
  </div>;
}
