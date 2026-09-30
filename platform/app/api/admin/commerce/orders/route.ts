import { authorizeAdmin } from "@/lib/admin-auth";
import { listOrders } from "@/lib/commerce/orders";
import { handleError, noStore } from "@/lib/http";

export async function GET(request: Request) {
  const admin = await authorizeAdmin(); if (admin instanceof Response) return admin;
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Math.min(10_000, Number.parseInt(params.get("page") ?? "1", 10) || 1));
  try { return Response.json(await listOrders({ queue: params.get("queue") ?? undefined, search: params.get("search") ?? undefined }, page), { headers: noStore }); }
  catch (error) { return handleError(error, "admin_orders_list_failed", "No se pudieron cargar los pedidos."); }
}
