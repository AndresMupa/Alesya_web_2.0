import { harveyAuthorized, listOutboundCandidates, recordHarveyContact } from "@/lib/crm/harvey";
import { handleError, noStore } from "@/lib/http";

const list = (value: string | null) => (value ?? "").split("|").map((item) => item.trim()).filter(Boolean);

/**
 * Colegios listos para prospección automática (etapa "Nuevo", con correo, aún no entregados a Harvey).
 * Harvey llama con `Authorization: Bearer HARVEY_SYNC_TOKEN`. Filtros: `limit` (1-200), `cities` (separadas por |,
 * tal como están en el CRM, p. ej. `Bogotá, D.C.|Chía`), `sources` (orígenes separados por |; incluyen sus
 * subcanales) y `requireWebsite=1`. Con `missingEmail=1` devuelve los que tienen sitio web pero no correo, para buscarlo.
 */
export async function GET(request: Request) {
  if (!harveyAuthorized(request)) return Response.json({ message: "No autorizado" }, { status: 401, headers: noStore });
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 30, 1), 200);
  try {
    const leads = await listOutboundCandidates({
      limit, cities: list(url.searchParams.get("cities")), sources: list(url.searchParams.get("sources")),
      requireWebsite: url.searchParams.get("requireWebsite") === "1", missingEmail: url.searchParams.get("missingEmail") === "1",
    });
    await recordHarveyContact("leads");
    return Response.json({ leads }, { headers: noStore });
  } catch (error) {
    return handleError(error, "harvey_leads_failed", "No se pudieron listar los colegios.");
  }
}
