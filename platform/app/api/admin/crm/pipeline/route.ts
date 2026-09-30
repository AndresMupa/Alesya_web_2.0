import { authorizeAdmin } from "@/lib/admin-auth";
import { getAgenda, getPipeline, getProspectQueue, getSalesMetrics, listFacets } from "@/lib/crm/leads";
import { handleError, noStore } from "@/lib/http";

/** Datos de la máquina de ventas: embudo por etapa, métricas, agenda de seguimientos y cola de prospección. */
export async function GET(request: Request) {
  const admin = await authorizeAdmin(); if (admin instanceof Response) return admin;
  const params = new URL(request.url).searchParams;
  const owner = params.get("owner")?.slice(0, 120) || undefined;
  const city = params.get("city")?.slice(0, 100) || undefined;
  try {
    const [pipeline, metrics, agenda, queue, facets] = await Promise.all([getPipeline({ owner }), getSalesMetrics(), getAgenda(40, { owner }), getProspectQueue(8, { owner, city }), listFacets()]);
    return Response.json({ ...pipeline, metrics, agenda, queue: queue.rows, queueTotal: queue.total, ...facets }, { headers: noStore });
  } catch (error) { return handleError(error, "crm_pipeline_failed", "No se pudo cargar la máquina de ventas."); }
}
