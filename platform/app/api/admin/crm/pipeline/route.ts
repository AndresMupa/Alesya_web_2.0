import { authorizeAdmin } from "@/lib/admin-auth";
import { getAgenda, getPipeline, getProspectQueue, getSalesMetrics } from "@/lib/crm/leads";
import { handleError, noStore } from "@/lib/http";

/** Datos de la máquina de ventas: embudo por etapa, métricas, agenda de seguimientos y cola de prospección. */
export async function GET(request: Request) {
  const admin = await authorizeAdmin(); if (admin instanceof Response) return admin;
  const owner = new URL(request.url).searchParams.get("owner")?.slice(0, 120) || undefined;
  try {
    const [pipeline, metrics, agenda, prospects] = await Promise.all([getPipeline({ owner }), getSalesMetrics(), getAgenda(), getProspectQueue()]);
    return Response.json({ ...pipeline, metrics, agenda, queue: prospects }, { headers: noStore });
  } catch (error) { return handleError(error, "crm_pipeline_failed", "No se pudo cargar la máquina de ventas."); }
}
