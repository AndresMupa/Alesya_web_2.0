import { harveyAuthorized, listOutboundCandidates } from "@/lib/crm/harvey";
import { handleError, noStore } from "@/lib/http";

/**
 * Colegios listos para prospección automática (etapa "Nuevo", con correo, aún no entregados a Harvey).
 * Harvey llama con `Authorization: Bearer HARVEY_SYNC_TOKEN`. Filtros: `limit` (1-200), `cities` (separadas por |,
 * tal como están en el CRM, p. ej. `Bogotá, D.C.|Chía`) y `requireWebsite=1`.
 */
export async function GET(request: Request) {
  if (!harveyAuthorized(request)) return Response.json({ message: "No autorizado" }, { status: 401, headers: noStore });
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 30, 1), 200);
  const cities = (url.searchParams.get("cities") ?? "").split("|").map((city) => city.trim()).filter(Boolean);
  const requireWebsite = url.searchParams.get("requireWebsite") === "1";
  try {
    const leads = await listOutboundCandidates({ limit, cities, requireWebsite });
    return Response.json({ leads }, { headers: noStore });
  } catch (error) {
    return handleError(error, "harvey_leads_failed", "No se pudieron listar los colegios.");
  }
}
