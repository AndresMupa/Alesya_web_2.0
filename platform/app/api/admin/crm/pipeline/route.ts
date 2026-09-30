import { authorizeAdmin } from "@/lib/admin-auth";
import { getAgenda, getPipeline, getProspectQueue, getSalesMetrics, getWithoutNextAction, listFacets } from "@/lib/crm/leads";
import { handleError, noStore } from "@/lib/http";
import { getSettings } from "@/lib/settings";

/** Datos de la máquina de ventas: embudo por etapa, métricas, agenda de seguimientos, cola de prospección y meta diaria. */
export async function GET(request: Request) {
  const admin = await authorizeAdmin(); if (admin instanceof Response) return admin;
  const params = new URL(request.url).searchParams;
  const owner = params.get("owner")?.slice(0, 120) || undefined;
  const city = params.get("city")?.slice(0, 100) || undefined;
  try {
    const [pipeline, metrics, agenda, queue, facets, settings, noNextAction] = await Promise.all([getPipeline({ owner }), getSalesMetrics(), getAgenda(80, { owner }), getProspectQueue(8, { owner, city }), listFacets(), getSettings(), getWithoutNextAction({ owner })]);
    return Response.json({ ...pipeline, metrics, agenda, noNextAction, queue: queue.rows, queueTotal: queue.total, ...facets, dailyGoal: Math.max(1, Number(settings["crm.daily_goal"]) || 20) }, { headers: noStore });
  } catch (error) { return handleError(error, "crm_pipeline_failed", "No se pudo cargar la máquina de ventas."); }
}
