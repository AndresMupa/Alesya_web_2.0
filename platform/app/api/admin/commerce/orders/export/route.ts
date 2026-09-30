import { authorizeAdmin } from "@/lib/admin-auth";
import { exportOrders, orderCsvHeader } from "@/lib/commerce/orders";
import { csvResponse, toCsv } from "@/lib/csv";
import { bogotaDay } from "@/lib/format";
import { handleError } from "@/lib/http";

export async function GET(request: Request) {
  const admin = await authorizeAdmin(); if (admin instanceof Response) return admin;
  const params = new URL(request.url).searchParams;
  try { return csvResponse(`pedidos-alesya-${bogotaDay()}.csv`, toCsv(orderCsvHeader, await exportOrders({ queue: params.get("queue") ?? "all" }))); }
  catch (error) { return handleError(error, "admin_orders_export_failed", "No se pudieron exportar los pedidos."); }
}
