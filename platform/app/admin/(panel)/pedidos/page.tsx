import { requireAdmin } from "@/lib/admin-auth";
import { OrdersExplorer } from "@/components/admin/commerce/orders-explorer";

export const metadata = { title: "Pedidos" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ pedido?: string }> }) {
  await requireAdmin();
  const { pedido } = await searchParams;
  return <OrdersExplorer initialOrder={pedido && /^[0-9a-f-]{36}$/.test(pedido) ? pedido : undefined} />;
}
