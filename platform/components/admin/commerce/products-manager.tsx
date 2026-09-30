"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Download, ExternalLink, LayoutGrid, Plus, RefreshCw, Table2, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, readTextFile, send, useJson } from "@/components/admin/kit";
import { ProductDrawer, type AdminProduct } from "@/components/admin/commerce/product-drawer";
import { ProductsBoard } from "@/components/admin/commerce/products-board";
import { ProductsTable } from "@/components/admin/commerce/products-table";
import { LOW_STOCK, categoryOrder, sortCategories } from "@/lib/commerce/constants";

const views = [
  { value: "all", label: "Todos", test: (product: AdminProduct) => product.status !== "archived" },
  { value: "active", label: "Publicados", test: (product: AdminProduct) => product.status === "active" },
  { value: "draft", label: "Borradores", test: (product: AdminProduct) => product.status === "draft" },
  { value: "noprice", label: "Sin precio", test: (product: AdminProduct) => product.status !== "archived" && product.priceInCents <= 0 },
  { value: "lowstock", label: "Stock bajo", test: (product: AdminProduct) => product.status === "active" && !product.backorder && product.stock <= LOW_STOCK },
  { value: "featured", label: "Destacados", test: (product: AdminProduct) => product.featured && product.status !== "archived" },
  { value: "archived", label: "Archivados", test: (product: AdminProduct) => product.status === "archived" },
] as const;

export function ProductsManager() {
  const [revision, setRevision] = useState(0);
  const { data, error, loading } = useJson<{ products: AdminProduct[] }>("/api/admin/commerce/products", revision);
  const [mode, setMode] = useState<"board" | "table">("board");
  const [view, setView] = useState<(typeof views)[number]["value"]>("all");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createIn, setCreateIn] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  const products = useMemo(() => data?.products ?? [], [data]);
  const categories = sortCategories([...categoryOrder, ...products.map((product) => product.category)]);
  const term = search.trim().toLowerCase();
  // Memorizado: el tablero se re-sincroniza cada vez que cambia la referencia de la lista.
  const visible = useMemo(() => {
    const test = views.find((item) => item.value === view)!.test;
    return products.filter((product) => test(product) && (!category || product.category === category) && (!term || `${product.name} ${product.sku} ${product.description}`.toLowerCase().includes(term)));
  }, [products, view, category, term]);
  const filtered = view !== "all" || !!category || !!term;
  const editing = products.find((product) => product.id === editingId) ?? null;

  async function importCsv(file: File) {
    const updateStock = confirm("¿El archivo es un conteo físico del inventario?\n\nAceptar: el stock de los productos existentes se reemplaza por la cantidad del archivo (queda un evento de conteo).\nCancelar: solo se actualizan nombre, categoría, precio y foto; el stock de los existentes no cambia.");
    setImporting(true);
    try {
      const result = await send<{ created: number; updated: number; invalid: number }>("/api/admin/commerce/products/import", "POST", { csv: await readTextFile(file), updateStock });
      if (result) { toast.success(`Importación lista: ${result.created} nuevos, ${result.updated} actualizados${result.invalid ? `, ${result.invalid} filas sin nombre` : ""}.`); reload(); }
    } finally { setImporting(false); if (fileInput.current) fileInput.current.value = ""; }
  }

  const count = (value: (typeof views)[number]["value"]) => products.filter(views.find((item) => item.value === value)!.test).length;

  return <>
    <PageHeader title="Productos e inventario" description="Catálogo de la tienda: precios, fotos, publicación, orden y stock con trazabilidad.">
      <button className="refresh-button" onClick={() => setCreateIn(categories[0] ?? "Electrónica")}><Plus size={15} /> Nuevo producto</button>
      <button className="refresh-button" onClick={() => fileInput.current?.click()} disabled={importing}><Upload size={15} /> {importing ? "Importando…" : "Importar CSV"}</button>
      <a className="refresh-button" href="/api/admin/commerce/products/export"><Download size={15} /> Exportar CSV</a>
      <Link className="refresh-button" href="/catalogo" target="_blank"><ExternalLink size={15} /> Ver tienda</Link>
      <button className="refresh-button" onClick={reload} disabled={loading}><RefreshCw size={15} /></button>
      <input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void importCsv(file); }} />
    </PageHeader>
    {error && <p className="checkout-status">{error}</p>}
    {count("noprice") > 0 && <p className="adm-callout">Hay <strong>{count("noprice")} productos sin precio</strong>: no aparecen en la tienda. Usa la vista <button type="button" className="adm-link-button" onClick={() => { setMode("table"); setView("noprice"); }}>Tabla · Sin precio</button> para asignarlos rápido: al poner el primer precio a un borrador, se publica.</p>}

    <section className="panel adm-section">
      <div className="adm-toolbar">
        <div className="admin-tabs" role="tablist" aria-label="Filtro de estado">
          {views.map((item) => <button key={item.value} role="tab" aria-selected={view === item.value} className={view === item.value ? "is-active" : ""} onClick={() => setView(item.value)}>{item.label} <span>{count(item.value)}</span></button>)}
        </div>
        <div className="adm-toolbar-end">
          <label className="adm-search"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nombre o SKU" aria-label="Buscar productos" /></label>
          <select className="admin-inline-input" value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Categoría"><option value="">Todas las categorías</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <div className="adm-segmented" role="group" aria-label="Vista">
            <button type="button" aria-pressed={mode === "board"} onClick={() => setMode("board")}><LayoutGrid size={15} /> Tablero</button>
            <button type="button" aria-pressed={mode === "table"} onClick={() => setMode("table")}><Table2 size={15} /> Tabla</button>
          </div>
        </div>
      </div>
      {!data ? <p className="adm-muted">{loading ? "Cargando catálogo…" : ""}</p> : mode === "board"
        ? <ProductsBoard products={visible} draggable={!filtered} reload={reload} onEdit={(product) => setEditingId(product.id)} onAdd={setCreateIn} />
        : <ProductsTable products={visible} reload={reload} onEdit={(product) => setEditingId(product.id)} />}
      <p className="adm-hint">Importar acepta el formato de <code>inventario-alesya.csv</code> (cantidad, nombre, categoria, sku_ref, precio_cop) y columnas opcionales estado, imagen, destacado, bajo_pedido y descripcion. Actualiza por SKU sin duplicar.</p>
    </section>
    <ProductDrawer product={editing} createIn={editing ? null : createIn} categories={categories} onClose={() => { setEditingId(null); setCreateIn(null); }} onSaved={reload} />
  </>;
}
