import { authorizeAdmin } from "@/lib/admin-auth";
import { getAnalytics } from "@/lib/crm/analytics";
import { handleError, noStore } from "@/lib/http";

/** Analítica comercial: pronóstico, conversión, días por etapa, canales, puntajes, ciudades, programas y sectores. */
export async function GET() {
  const admin = await authorizeAdmin(); if (admin instanceof Response) return admin;
  try { return Response.json(await getAnalytics(), { headers: noStore }); }
  catch (error) { return handleError(error, "crm_analytics_failed", "No se pudo calcular la analítica."); }
}
