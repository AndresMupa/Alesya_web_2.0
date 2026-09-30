"use client";
/* eslint-disable @next/next/no-img-element -- fotos de /media y /uploads servidas tal cual (en cPanel no hay optimizador de imágenes). */

import { FormEvent, useMemo, useRef, useState } from "react";
import { GripVertical, ImageOff, PackageOpen, Pencil, Plus, Star } from "lucide-react";
import { send } from "@/components/admin/kit";
import type { AdminProduct } from "@/components/admin/commerce/product-drawer";
import { LOW_STOCK, categoryOrder, sortCategories } from "@/lib/commerce/constants";
import { formatMoney } from "@/lib/format";

const TONES = ["cyan", "yellow", "coral", "violet", "mint"] as const;
const toneFor = (category: string) => TONES[Math.max(0, categoryOrder.indexOf(category)) % TONES.length];
const columnsOf = (products: AdminProduct[]) => sortCategories([...categoryOrder, ...products.map((product) => product.category)]);

type Props = {
  products: AdminProduct[];
  /** Con filtros activos se ve un subconjunto: arrastrar recalcularía mal las posiciones, así que se desactiva. */
  draggable: boolean;
  reload: () => void;
  onEdit: (product: AdminProduct) => void;
  onAdd: (category: string) => void;
};

/** Tablero visual por categorías: arrastra tarjetas para ordenarlas o moverlas de categoría. */
export function ProductsBoard({ products, draggable, reload, onEdit, onAdd }: Props) {
  const [board, setBoard] = useState(products);
  const [previous, setPrevious] = useState(products);
  const dragId = useRef<string | null>(null);
  const [dropHint, setDropHint] = useState<string | null>(null);
  const [saved, setSaved] = useState(() => new Map(products.map((product) => [product.id, { position: product.position, category: product.category }])));

  // Re-sincroniza cuando el padre recarga datos del servidor (patrón "ajustar estado al cambiar props").
  if (products !== previous) {
    setPrevious(products);
    setBoard(products);
    setSaved(new Map(products.map((product) => [product.id, { position: product.position, category: product.category }])));
  }

  const categories = useMemo(() => columnsOf(board), [board]);
  const byCategory = useMemo(() => {
    const map = new Map<string, AdminProduct[]>(categories.map((category) => [category, []]));
    for (const product of [...board].sort((a, b) => a.position - b.position)) map.get(product.category)?.push(product);
    return map;
  }, [board, categories]);

  async function persistOrder(next: AdminProduct[]) {
    const changed = next.filter((product) => { const before = saved.get(product.id); return !before || before.position !== product.position || before.category !== product.category; });
    if (!changed.length) return;
    const result = await send("/api/admin/commerce/products/reorder", "PATCH", { items: changed.map(({ id, position, category }) => ({ id, position, category })) }, "Orden guardado.");
    if (result) setSaved(new Map(next.map((product) => [product.id, { position: product.position, category: product.category }])));
    else reload();
  }

  function moveTo(targetCategory: string, beforeId: string | null) {
    const id = dragId.current; if (!id) return;
    const dragged = board.find((product) => product.id === id); if (!dragged) return;
    const columns = new Map<string, AdminProduct[]>(columnsOf(board).map((category) => [category, []]));
    for (const product of board.filter((item) => item.id !== id).sort((a, b) => a.position - b.position)) columns.get(product.category)?.push(product);
    const column = columns.get(targetCategory) ?? [];
    const index = beforeId ? column.findIndex((product) => product.id === beforeId) : column.length;
    column.splice(index < 0 ? column.length : index, 0, { ...dragged, category: targetCategory });
    columns.set(targetCategory, column);
    const next: AdminProduct[] = [];
    for (const [category, items] of columns) items.forEach((product, position) => next.push({ ...product, category, position }));
    setBoard(next);
    dragId.current = null; setDropHint(null);
    void persistOrder(next);
  }

  async function adjustStock(event: FormEvent<HTMLFormElement>, product: AdminProduct) {
    event.preventDefault();
    const form = event.currentTarget; const delta = Number(new FormData(form).get("delta"));
    if (!Number.isInteger(delta) || delta === 0) return;
    if (await send(`/api/admin/commerce/products/${product.id}/inventory`, "POST", { delta, reason: delta > 0 ? "restock" : "adjustment" }, `${product.name}: ${delta > 0 ? "+" : ""}${delta} und.`)) { form.reset(); reload(); }
  }

  return <div className="pboard">
    <div className="pboard-hint"><GripVertical size={14} /> {draggable ? "Arrastra las tarjetas para ordenarlas o muévelas entre categorías. El orden es el de la tienda." : "Quita los filtros para reordenar arrastrando."}</div>
    <div className="pboard-columns">
      {categories.map((category) => {
        const items = byCategory.get(category) ?? [];
        return <section key={category} className={`pboard-col${dropHint === category ? " is-target" : ""}`} data-tone={toneFor(category)}
          onDragOver={(event) => { if (!draggable) return; event.preventDefault(); setDropHint(category); }}
          onDragLeave={(event) => { if (event.currentTarget === event.target) setDropHint((current) => (current === category ? null : current)); }}
          onDrop={(event) => { event.preventDefault(); moveTo(category, null); }}>
          <header className="pboard-col-head"><span className="pboard-dot" /><h3>{category}</h3><span className="pboard-count">{items.length}</span></header>
          <div className="pboard-cards">
            {items.map((product) => <article key={product.id} className="pcard" draggable={draggable}
              onDragStart={() => { dragId.current = product.id; }}
              onDragEnd={() => { dragId.current = null; setDropHint(null); }}
              onDragOver={(event) => { if (!draggable) return; event.preventDefault(); event.stopPropagation(); setDropHint(category); }}
              onDrop={(event) => { event.preventDefault(); event.stopPropagation(); moveTo(category, product.id); }}>
              <div className="pcard-media" data-tone={toneFor(category)}>
                {product.imageUrl ? <img src={product.imageUrl} alt={product.name} loading="lazy" /> : <PackageOpen size={30} strokeWidth={1.2} />}
                <span className={`pcard-flag${product.status === "active" ? " is-live" : ""}`}>{product.status === "active" ? "Publicado" : product.status === "archived" ? "Archivado" : "Borrador"}</span>
                {product.featured && <Star className="pcard-star" size={15} fill="currentColor" aria-label="Destacado" />}
                {draggable && <GripVertical className="pcard-grip" size={16} />}
              </div>
              <div className="pcard-body">
                <p className="pcard-sku">{product.sku}</p>
                <h4>{product.name}</h4>
                <div className="pcard-meta">
                  <strong className={product.priceInCents ? "" : "pcard-noprice"}>{product.priceInCents ? formatMoney(product.priceInCents) : "Sin precio"}</strong>
                  <span className={`pcard-stock${product.stock <= LOW_STOCK && !product.backorder ? " is-low" : ""}`}>{product.stock} und{product.backorder ? " · bajo pedido" : ""}</span>
                </div>
                <div className="pcard-actions">
                  <form onSubmit={(event) => void adjustStock(event, product)}>
                    <input name="delta" type="number" step="1" placeholder="+5 / -2" aria-label={`Ajustar stock de ${product.name}`} required />
                    <button type="submit">Stock</button>
                  </form>
                  <button className="pcard-edit-btn" type="button" onClick={() => onEdit(product)} aria-label={`Editar ${product.name}`}><Pencil size={14} /> Editar</button>
                </div>
              </div>
            </article>)}
            {!items.length && <p className="pboard-empty"><ImageOff size={18} /> Sin productos.</p>}
          </div>
          <button className="pboard-add-btn" type="button" onClick={() => onAdd(category)}><Plus size={16} /> Agregar a {category}</button>
        </section>;
      })}
    </div>
  </div>;
}
