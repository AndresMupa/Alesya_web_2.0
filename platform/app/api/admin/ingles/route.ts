import { authorizeAdmin } from "@/lib/admin-auth";
import { englishAccessConfigured } from "@/lib/english/access";
import { englishStats, listLevels } from "@/lib/english/resources";
import { handleError, noStore } from "@/lib/http";
import { uploadsAvailable } from "@/lib/storage";

/** Resumen del Área de Inglés para el panel: niveles con su material publicado, totales y estado del servidor. */
export async function GET() {
  const admin = await authorizeAdmin(); if (admin instanceof Response) return admin;
  try {
    const [levels, stats] = await Promise.all([listLevels(), englishStats()]);
    return Response.json({ levels, stats, uploads: uploadsAvailable(), accessConfigured: englishAccessConfigured() }, { headers: noStore });
  } catch (error) { return handleError(error, "english_overview_failed", "No se pudo cargar el Área de Inglés."); }
}
