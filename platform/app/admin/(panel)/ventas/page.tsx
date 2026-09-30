import { requireAdmin } from "@/lib/admin-auth";
import { SalesMachine } from "@/components/admin/crm/sales-machine";

export const metadata = { title: "Máquina de ventas" };

export default async function SalesPage() {
  await requireAdmin();
  return <SalesMachine />;
}
