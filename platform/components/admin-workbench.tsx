"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { leadStages, manualOrderTransitions, orderStatusLabel, isPendingStatus, type OrderStatus } from "@/lib/statuses";

type Lead = { id: string; name: string; organization: string; email: string; phone: string | null; message: string; stage: string; owner: string | null };
type Order = { id: string; reference: string; customerName: string; customerEmail: string; shippingCity: string; totalInCents: number; status: string };
type Product = { id: string; sku: string; name: string; priceInCents: number; stock: number; status: string };
type Overview = { leads: Lead[]; orders: Order[]; products: Product[] };
export type WorkspaceTab = "crm" | "orders" | "products";

const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

async function fetchOverview(): Promise<Overview | null> {
  const response = await fetch("/api/admin/overview", { cache: "no-store" });
  return response.ok ? response.json() : null;
}

async function send(url: string, method: "POST" | "PATCH", body: unknown) {
  const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({})) as { message?: string };
  return { ok: response.ok, message: result.message };
}

export function AdminWorkbench({ initialTab = "crm" }: { initialTab?: WorkspaceTab }) {
  const router = useRouter();
  const [data, setData] = useState<Overview>({ leads: [], orders: [], products: [] });
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<WorkspaceTab>(initialTab);

  function apply(overview: Overview | null) {
    if (!overview) { setState("error"); return; }
    setData(overview);
    setState("ready");
  }

  useEffect(() => {
    let active = true;
    fetchOverview().then((overview) => { if (active) apply(overview); }, () => { if (active) setState("error"); });
    return () => { active = false; };
  }, []);

  async function refresh() {
    setState("loading");
    apply(await fetchOverview().catch(() => null));
    router.refresh();
  }

  async function mutate(url: string, method: "POST" | "PATCH", body: unknown, success: string) {
    setNotice("Guardando…");
    const result = await send(url, method, body);
    setNotice(result.ok ? success : result.message ?? "No se pudo guardar el cambio.");
    if (result.ok) await refresh();
    return result.ok;
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (await mutate("/api/admin/products", "POST", Object.fromEntries(new FormData(form)), "Producto creado y publicado en el catálogo.")) form.reset();
  }

  async function adjustStock(event: FormEvent<HTMLFormElement>, productId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const delta = Number(new FormData(form).get("delta"));
    if (!Number.isInteger(delta) || delta === 0) { setNotice("Indica una cantidad entera distinta de cero."); return; }
    if (await mutate("/api/admin/inventory", "POST", { productId, delta, reason: delta > 0 ? "restock" : "adjustment" }, "Inventario actualizado.")) form.reset();
  }

  const tabs: Array<{ key: WorkspaceTab; label: string; count: number }> = [
    { key: "crm", label: "Clientes / CRM", count: data.leads.length },
    { key: "orders", label: "Pedidos", count: data.orders.length },
    { key: "products", label: "Productos e inventario", count: data.products.length },
  ];

  return (
    <section className="panel admin-workbench" id="gestion">
      <div className="panel-header">
        <div><h2>Gestión diaria</h2><p>Clientes, oportunidades, pedidos y catálogo en un solo lugar.</p></div>
        <button className="refresh-button" onClick={() => void refresh()} disabled={state === "loading"}><RefreshCw size={15} /> {state === "loading" ? "Cargando…" : "Actualizar"}</button>
      </div>
      {state === "error" ? <div className="checkout-status">No fue posible cargar la operación. Revisa la conexión de la base de datos.</div> : <>
        <div className="admin-tabs" role="tablist" aria-label="Áreas de gestión">
          {tabs.map((item) => <button key={item.key} role="tab" aria-selected={tab === item.key} className={tab === item.key ? "is-active" : ""} onClick={() => setTab(item.key)}>{item.label} <span>{item.count}</span></button>)}
        </div>
        {notice && <p className="admin-notice" role="status">{notice}</p>}
        <div role="tabpanel" aria-live="polite">
          {tab === "crm" && <Table className="admin-table"><TableHeader><TableRow><TableHead>Contacto</TableHead><TableHead>Institución</TableHead><TableHead>Necesidad</TableHead><TableHead>Responsable</TableHead><TableHead>Etapa</TableHead></TableRow></TableHeader><TableBody>{data.leads.length ? data.leads.map((lead) => <TableRow key={lead.id}>
            <TableCell><strong>{lead.name}</strong><small><a href={`mailto:${lead.email}`}>{lead.email}</a>{lead.phone && <> · <a href={`tel:${lead.phone}`}>{lead.phone}</a></>}</small></TableCell>
            <TableCell>{lead.organization}</TableCell>
            <TableCell className="admin-message" title={lead.message}>{lead.message}</TableCell>
            <TableCell><input className="admin-inline-input" aria-label={`Responsable de ${lead.name}`} defaultValue={lead.owner ?? ""} maxLength={120} placeholder="Asignar" onBlur={(event) => { const owner = event.currentTarget.value.trim(); if (owner !== (lead.owner ?? "")) void mutate("/api/admin/leads", "PATCH", { id: lead.id, owner }, "Responsable asignado."); }} /></TableCell>
            <TableCell><select className="admin-inline-input" aria-label={`Etapa de ${lead.name}`} value={lead.stage} onChange={(event) => void mutate("/api/admin/leads", "PATCH", { id: lead.id, stage: event.target.value }, "Etapa actualizada.")}>{leadStages.map((stage) => <option key={stage.value} value={stage.value}>{stage.label}</option>)}</select></TableCell>
          </TableRow>) : <TableRow><TableCell colSpan={5}>Aún no hay oportunidades registradas.</TableCell></TableRow>}</TableBody></Table>}
          {tab === "orders" && <Table className="admin-table"><TableHeader><TableRow><TableHead>Referencia</TableHead><TableHead>Cliente</TableHead><TableHead>Total</TableHead><TableHead>Estado</TableHead><TableHead>Siguiente paso</TableHead></TableRow></TableHeader><TableBody>{data.orders.length ? data.orders.map((order) => <TableRow key={order.id}>
            <TableCell><strong>{order.reference}</strong></TableCell>
            <TableCell>{order.customerName}<small>{order.customerEmail} · {order.shippingCity}</small></TableCell>
            <TableCell>{money.format(order.totalInCents / 100)}</TableCell>
            <TableCell><span className={isPendingStatus(order.status) ? "status-pill pending" : "status-pill"}>{orderStatusLabel(order.status)}</span></TableCell>
            <TableCell><div className="admin-actions">{(manualOrderTransitions[order.status as OrderStatus] ?? []).map((next) => <button key={next} className="refresh-button" onClick={() => { if (next !== "cancelled" || confirm(`¿Cancelar el pedido ${order.reference}?`)) void mutate("/api/admin/orders", "PATCH", { id: order.id, status: next }, `Pedido ${order.reference}: ${orderStatusLabel(next).toLowerCase()}.`); }}>{next === "cancelled" ? "Cancelar" : `Marcar ${orderStatusLabel(next).toLowerCase()}`}</button>)}</div></TableCell>
          </TableRow>) : <TableRow><TableCell colSpan={5}>Aún no hay pedidos registrados.</TableCell></TableRow>}</TableBody></Table>}
          {tab === "products" && <div className="admin-products-layout"><Table className="admin-table"><TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Producto</TableHead><TableHead>Stock</TableHead><TableHead>Ajustar</TableHead></TableRow></TableHeader><TableBody>{data.products.length ? data.products.map((product) => <TableRow key={product.id}>
            <TableCell>{product.sku}</TableCell>
            <TableCell><strong>{product.name}</strong><small>{money.format(product.priceInCents / 100)}</small></TableCell>
            <TableCell><span className={product.stock <= 5 ? "status-pill pending" : "status-pill"}>{product.stock}</span></TableCell>
            <TableCell><form className="admin-actions" onSubmit={(event) => void adjustStock(event, product.id)}><input className="admin-inline-input" name="delta" type="number" step="1" placeholder="+10 / -2" aria-label={`Ajuste de stock para ${product.name}`} required /><button className="refresh-button" type="submit">Aplicar</button></form></TableCell>
          </TableRow>) : <TableRow><TableCell colSpan={4}>Crea el primer producto administrable.</TableCell></TableRow>}</TableBody></Table><form className="admin-product-form" onSubmit={createProduct}><h3>Nuevo producto</h3><label>Nombre<input name="name" required /></label><div><label>SKU<input name="sku" required /></label><label>Precio COP<input name="price" type="number" min="1000" required /></label></div><div><label>Categoría<select name="category"><option>Robótica</option><option>Electrónica</option><option>Impresión 3D</option><option>Bricolaje</option><option>Libros</option></select></label><label>Stock<input name="stock" type="number" min="0" defaultValue="0" required /></label></div><label>Descripción<textarea name="description" rows={3} required /></label><button className="button button-dark" type="submit">Crear y publicar</button></form></div>}
        </div>
      </>}
    </section>
  );
}
