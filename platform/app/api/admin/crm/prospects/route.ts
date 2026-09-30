import { authorizeAdmin } from "@/lib/admin-auth";
import { getProspectQueue, listFacets } from "@/lib/crm/leads";
import { handleError, noStore } from "@/lib/http";

/** Cola de prospección para el modo guiado: los siguientes colegios por contactar, con filtros de responsable y ciudad. */
export async function GET(request: Request) {
  const admin = await authorizeAdmin(); if (admin instanceof Response) return admin;
  const params = new URL(request.url).searchParams;
  const limit = Math.max(1, Math.min(50, Number.parseInt(params.get("limit") ?? "25", 10) || 25));
  try {
    const [queue, facets] = await Promise.all([getProspectQueue(limit, { owner: params.get("owner") ?? undefined, city: params.get("city") ?? undefined }), listFacets()]);
    return Response.json({ ...queue, ...facets }, { headers: noStore });
  } catch (error) { return handleError(error, "crm_prospects_failed", "No se pudo cargar la cola de prospección."); }
}
