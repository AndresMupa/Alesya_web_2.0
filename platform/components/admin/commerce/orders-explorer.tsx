"use client";

import { useCallback, useState } from "react";
import { Download, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, useDebounced, useJson } from "@/components/admin/kit";
import { useAsesor } from "@/components/admin/asesor";
import { NewOrderDrawer } from "@/components/admin/commerce/new-order-drawer";
import { OrderDrawer, StatusPill } from "@/components/admin/commerce/order-drawer";
import { orderQueues } from "@/lib/commerce/constants";
import { formatDateTime, formatMoney } from "@/lib/format";

type Row = { id: string; reference: string; customerName: string; customerEmail: string; customerPhone: string; shippingCity: string; totalInCents: number; status: string; createdAt: string; items: number };
type Result = { rows: Row[]; total: number; page: number; pageSize: number; queue: string; counts: Record<string, number> };

export function OrdersExplorer({ initialOrder }: { initialOrder?: string }) {
  const asesor = useAsesor();
  const [queue, setQueue] = useState<string>(initialOrder ? "all" : "prepare");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [openOrder, setOpenOrder] = useState<string | null>(initialOrder ?? null);
  const [creating, setCreating] = useState(false);
  const term = useDebounced(search.trim(), 300);
  const params = new URLSearchParams({ queue, page: String(page), ...(term && { search: term }) });
  const { data, error, loading } = useJson<Result>(`/api/admin/commerce/orders?${params}`, revision);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 30)));

  function closeOrder() {
    setOpenOrder(null);
    if (window.location.search.includes("pedido=")) window.history.replaceState(null, "", "/admin/pedidos");
  }

  return <>
    <PageHeader title="Pedidos" description="Pagos confirmados, preparación, envío y entrega. Cada paso queda en la trazabilidad del pedido.">
      <button className="refresh-button" onClick={() => setCreating(true)}><Plus size={15} /> Nuevo pedido</button>
      <a className="refresh-button" href={`/api/admin/commerce/orders/export?queue=${queue}`}><Download size={15} /> Exportar CSV</a>
      <button className="refresh-button" onClick={reload} disabled={loading}><RefreshCw size={15} /> {loading ? "Cargando…" : "Actualizar"}</button>
    </PageHeader>
    <section className="panel adm-section">
      <div className="adm-toolbar">
        <div className="admin-tabs" role="tablist" aria-label="Bandejas de pedidos">
          {orderQueues.map((item) => <button key={item.value} role="tab" aria-selected={queue === item.value} className={queue === item.value ? "is-active" : ""} onClick={() => { setQueue(item.value); setPage(1); }}>{item.label} <span>{data?.counts[item.value] ?? 0}</span></button>)}
        </div>
        <label className="adm-search"><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar referencia, cliente, correo o celular" aria-label="Buscar pedidos" /></label>
      </div>
      {error && <p className="checkout-status">{error}</p>}
      <div className="sales-table-scroll">
        <table className="admin-table adm-table adm-clickable">
          <thead><tr><th>Pedido</th><th>Cliente</th><th>Ítems</th><th>Total</th><th>Estado</th></tr></thead>
          <tbody>{data?.rows.length ? data.rows.map((order) => <tr key={order.id} onClick={() => setOpenOrder(order.id)}>
            <td><strong>{order.reference}</strong><small>{formatDateTime(order.createdAt)}</small></td>
            <td>{order.customerName}<small>{order.shippingCity} · {order.customerPhone}</small></td>
            <td>{order.items}</td>
            <td>{formatMoney(order.totalInCents)}</td>
            <td><StatusPill status={order.status} /></td>
          </tr>) : <tr><td colSpan={5}>{loading ? "Cargando pedidos…" : "No hay pedidos en esta bandeja."}</td></tr>}</tbody>
        </table>
      </div>
      <div className="sales-pagination"><span>{data?.total ?? 0} pedidos · página {page} de {pages}</span><div><button className="refresh-button" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Anterior</button><button className="refresh-button" disabled={page >= pages || loading} onClick={() => setPage(page + 1)}>Siguiente</button></div></div>
      <p className="adm-hint">“Nuevo pedido” registra ventas por WhatsApp o a colegios: el pedido queda esperando pago y desde su ficha envías el enlace de Wompi o registras el pago recibido. El CSV exporta la bandeja activa.</p>
    </section>
    <NewOrderDrawer open={creating} asesor={asesor} onClose={() => setCreating(false)} onCreated={(id, checkoutUrl) => { setCreating(false); setQueue("unpaid"); setPage(1); reload(); setOpenOrder(id); if (checkoutUrl) toast.info("Enlace de pago listo en la ficha del pedido."); }} />
    <OrderDrawer orderId={openOrder} onClose={closeOrder} onChanged={reload} />
  </>;
}
