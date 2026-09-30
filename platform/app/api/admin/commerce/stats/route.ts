import { authorizeAdmin } from "@/lib/admin-auth";
import { getCommerceStats } from "@/lib/commerce/stats";
import { handleError, noStore } from "@/lib/http";

/** Ventas por semana, productos más vendidos y pedidos por estado. */
export async function GET() {
  const admin = await authorizeAdmin(); if (admin instanceof Response) return admin;
  try { return Response.json(await getCommerceStats(), { headers: noStore }); }
  catch (error) { return handleError(error, "commerce_stats_failed", "No se pudieron calcular las ventas."); }
}
