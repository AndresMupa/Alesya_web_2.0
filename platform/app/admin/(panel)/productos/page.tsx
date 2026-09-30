import { requireAdmin } from "@/lib/admin-auth";
import { ProductsManager } from "@/components/admin/commerce/products-manager";

export const metadata = { title: "Productos e inventario" };

export default async function ProductsPage() {
  await requireAdmin();
  return <ProductsManager />;
}
