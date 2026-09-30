import { authorizeAdmin } from "@/lib/admin-auth";
import { getTeamStats } from "@/lib/crm/leads";
import { handleError, noStore } from "@/lib/http";

/** Rendimiento del equipo: por asesor, por canal de origen y motivos de pérdida. */
export async function GET() {
  const admin = await authorizeAdmin(); if (admin instanceof Response) return admin;
  try { return Response.json(await getTeamStats(), { headers: noStore }); }
  catch (error) { return handleError(error, "crm_stats_failed", "No se pudo calcular el rendimiento."); }
}
