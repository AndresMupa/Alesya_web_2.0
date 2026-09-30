"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { GripVertical, ImageOff, PackageOpen, Pencil, Plus, X } from "lucide-react";

export type BoardProduct = { id: string; sku: string; name: string; description: string; category: string; priceInCents: number; stock: number; status: string; imageUrl: string | null; position: number };

const CATEGORY_ORDER = ["Robótica", "Electrónica", "Impresión 3D", "Bricolaje", "Libros"];
const TONES = ["cyan", "yellow", "coral", "violet", "mint"] as const;
const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

function toneFor(category: string) { const idx = Math.max(0, CATEGORY_ORDER.indexOf(category)); return TONES[idx % TONES.length]; }
function orderedCategories(products: BoardProduct[]) {
  const present = Array.from(new Set(products.map((p) => p.category)));
  const extras = present.filter((c) => !CATEGORY_ORDER.includes(c)).sort();
  return [...CATEGORY_ORDER, ...extras];
}

type Props = {
  products: BoardProduct[];
  reload: () => Promise<void> | void;
  notify: (message: string) => void;
};

export function ProductsBoard({ products, reload, notify }: Props) {
  const [board, setBoard] = useState<BoardProduct[]>(products);
  const [prevProducts, setPrevProducts] = useState(products);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);
  const [dropHint, setDropHint] = useState<string | null>(null);
  const [saved, setSaved] = useState<Map<string, { position: number; category: string }>>(() => new Map(products.map((p) => [p.id, { position: p.position, category: p.category }])));

  // Re-sync when the parent reloads server data (React's "adjust state on prop change" pattern).
  if (products !== prevProducts) {
    setPrevProducts(products);
    setBoard(products);
    setSaved(new Map(products.map((p) => [p.id, { position: p.position, category: p.category }])));
  }

  const categories = useMemo(() => orderedCategories(board), [board]);
  const byCategory = useMemo(() => {
    const map = new Map<string, BoardProduct[]>();
    for (const cat of categories) map.set(cat, []);
    for (const p of [...board].sort((a, b) => a.position - b.position)) { if (!map.has(p.category)) map.set(p.category, []); map.get(p.category)!.push(p); }
    return map;
  }, [board, categories]);

  async function persistOrder(next: BoardProduct[]) {
    const changed = next.filter((p) => { const prev = saved.get(p.id); return !prev || prev.position !== p.position || prev.category !== p.category; });
    if (!changed.length) return;
    notify("Guardando orden…");
    const response = await fetch("/api/admin/products/reorder", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: changed.map((p) => ({ id: p.id, position: p.position, category: p.category })) }) });
    if (response.ok) { setSaved(new Map(next.map((p) => [p.id, { position: p.position, category: p.category }]))); notify("Orden guardado."); }
    else { notify("No se pudo guardar el orden."); void reload(); }
  }

  function moveTo(targetCategory: string, beforeId: string | null) {
    const id = dragId.current; if (!id) return;
    const dragged = board.find((p) => p.id === id); if (!dragged) return;
    const rest = board.filter((p) => p.id !== id);
    const columns = new Map<string, BoardProduct[]>();
    for (const cat of orderedCategories(board)) columns.set(cat, []);
    for (const p of [...rest].sort((a, b) => a.position - b.position)) { if (!columns.has(p.category)) columns.set(p.category, []); columns.get(p.category)!.push(p); }
    if (!columns.has(targetCategory)) columns.set(targetCategory, []);
    const column = columns.get(targetCategory)!;
    const index = beforeId ? column.findIndex((p) => p.id === beforeId) : column.length;
    column.splice(index < 0 ? column.length : index, 0, { ...dragged, category: targetCategory });
    const next: BoardProduct[] = [];
    for (const [cat, items] of columns) items.forEach((p, i) => next.push({ ...p, category: cat, position: i }));
    setBoard(next);
    dragId.current = null; setDropHint(null);
    void persistOrder(next);
  }

  async function mutate(url: string, method: "POST" | "PATCH", body: unknown, success: string) {
    notify("Guardando…");
    const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({})) as { ok?: boolean; message?: string };
    if (response.ok) { notify(success); await reload(); return true; }
    notify(result.message ?? "No se pudo guardar el cambio."); return false;
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>, product: BoardProduct) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = { id: product.id, name: String(form.get("name") ?? "").trim(), price: Number(form.get("price")), category: String(form.get("category")), description: String(form.get("description") ?? "").trim(), imageUrl: String(form.get("imageUrl") ?? "").trim(), status: (form.get("status") ? "active" : "draft") as "active" | "draft" };
    if (await mutate("/api/admin/products", "PATCH", body, "Producto actualizado.")) setEditing(null);
  }

  async function adjustStock(event: FormEvent<HTMLFormElement>, product: BoardProduct) {
    event.preventDefault();
    const form = event.currentTarget; const delta = Number(new FormData(form).get("delta"));
    if (!Number.isInteger(delta) || delta === 0) { notify("Indica una cantidad distinta de cero."); return; }
    if (await mutate("/api/admin/inventory", "POST", { productId: product.id, delta, reason: delta > 0 ? "restock" : "adjustment" }, "Inventario actualizado.")) form.reset();
  }

  async function createProduct(event: FormEvent<HTMLFormElement>, category: string) {
    event.preventDefault();
    const form = event.currentTarget; const data = Object.fromEntries(new FormData(form));
    if (await mutate("/api/admin/products", "POST", { ...data, category }, "Producto agregado al bloque.")) { form.reset(); setAdding(null); }
  }

  return (
    <div className="pboard">
      <div className="pboard-hint"><GripVertical size={14} /> Arrastra las tarjetas para ordenarlas o muévelas entre bloques. Los cambios se guardan solos.</div>
      <div className="pboard-columns">
        {categories.map((category) => {
          const items = byCategory.get(category) ?? [];
          return (
            <section
              key={category}
              className={`pboard-col${dropHint === category ? " is-target" : ""}`}
              data-tone={toneFor(category)}
              onDragOver={(e) => { e.preventDefault(); setDropHint(category); }}
              onDragLeave={(e) => { if (e.currentTarget === e.target) setDropHint((c) => (c === category ? null : c)); }}
              onDrop={(e) => { e.preventDefault(); moveTo(category, null); }}
            >
              <header className="pboard-col-head"><span className="pboard-dot" /><h3>{category}</h3><span className="pboard-count">{items.length}</span></header>
              <div className="pboard-cards">
                {items.map((product) => (
                  <article
                    key={product.id}
                    className={`pcard${editing === product.id ? " is-editing" : ""}`}
                    draggable={editing !== product.id}
                    onDragStart={() => { dragId.current = product.id; }}
                    onDragEnd={() => { dragId.current = null; setDropHint(null); }}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDropHint(category); }}
                    onDrop={(e) => { e.preventDefault(); e.stopPropagation(); moveTo(category, product.id); }}
                  >
                    {editing === product.id ? (
                      <form className="pcard-edit" onSubmit={(e) => void saveEdit(e, product)}>
                        <div className="pcard-edit-head"><strong>Editar</strong><button type="button" aria-label="Cerrar" onClick={() => setEditing(null)}><X size={15} /></button></div>
                        <label>Nombre<input name="name" defaultValue={product.name} required maxLength={160} /></label>
                        <div className="pcard-edit-row">
                          <label>Precio COP<input name="price" type="number" min="0" step="1000" defaultValue={Math.round(product.priceInCents / 100)} /></label>
                          <label>Categoría<select name="category" defaultValue={product.category}>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
                        </div>
                        <label>Imagen (URL o /media/archivo.jpg)<input name="imageUrl" defaultValue={product.imageUrl ?? ""} placeholder="/media/producto.jpg" maxLength={500} /></label>
                        <label>Descripción<textarea name="description" defaultValue={product.description} rows={2} required /></label>
                        <label className="pcard-status"><input type="checkbox" name="status" value="active" defaultChecked={product.status === "active"} /> Publicado en la tienda</label>
                        <button className="button button-dark" type="submit">Guardar cambios</button>
                      </form>
                    ) : (
                      <>
                        <div className="pcard-media" data-tone={toneFor(category)}>
                          {product.imageUrl ? // eslint-disable-next-line @next/next/no-img-element
                            <img src={product.imageUrl} alt={product.name} loading="lazy" /> : <PackageOpen size={30} strokeWidth={1.2} />}
                          <span className={`pcard-flag${product.status === "active" ? " is-live" : ""}`}>{product.status === "active" ? "Publicado" : "Borrador"}</span>
                          <GripVertical className="pcard-grip" size={16} />
                        </div>
                        <div className="pcard-body">
                          <p className="pcard-sku">{product.sku}</p>
                          <h4>{product.name}</h4>
                          <div className="pcard-meta">
                            <strong className={product.priceInCents ? "" : "pcard-noprice"}>{product.priceInCents ? money.format(product.priceInCents / 100) : "Sin precio"}</strong>
                            <span className={`pcard-stock${product.stock <= 5 ? " is-low" : ""}`}>{product.stock} und</span>
                          </div>
                          <div className="pcard-actions">
                            <form onSubmit={(e) => void adjustStock(e, product)}>
                              <input name="delta" type="number" step="1" placeholder="+5 / -2" aria-label={`Ajustar stock de ${product.name}`} required />
                              <button type="submit">Stock</button>
                            </form>
                            <button className="pcard-edit-btn" type="button" onClick={() => setEditing(product.id)} aria-label={`Editar ${product.name}`}><Pencil size={14} /> Editar</button>
                          </div>
                        </div>
                      </>
                    )}
                  </article>
                ))}
                {!items.length && <p className="pboard-empty"><ImageOff size={18} /> Sin productos. Arrastra aquí o agrega uno.</p>}
              </div>
              {adding === category ? (
                <form className="pboard-add" onSubmit={(e) => void createProduct(e, category)}>
                  <input name="name" placeholder="Nombre del producto" required minLength={3} />
                  <div className="pboard-add-row"><input name="sku" placeholder="SKU" required minLength={2} /><input name="price" type="number" min="0" step="1000" placeholder="Precio COP" defaultValue={0} /></div>
                  <div className="pboard-add-row"><input name="stock" type="number" min="0" placeholder="Stock" defaultValue={0} required /><input name="imageUrl" placeholder="/media/foto.jpg (opcional)" /></div>
                  <input name="description" placeholder="Descripción breve" required minLength={5} defaultValue="Producto del inventario Alesya." />
                  <div className="pboard-add-actions"><button className="button button-dark" type="submit">Agregar</button><button type="button" onClick={() => setAdding(null)}>Cancelar</button></div>
                </form>
              ) : (
                <button className="pboard-add-btn" type="button" onClick={() => setAdding(category)}><Plus size={16} /> Agregar a {category}</button>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
