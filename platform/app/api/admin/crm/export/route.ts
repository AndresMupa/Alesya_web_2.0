import { authorizeAdmin } from "@/lib/admin-auth";
import { exportLeads, leadCsvHeader, leadFiltersFrom } from "@/lib/crm/leads";
import { csvResponse, toCsv } from "@/lib/csv";
import { bogotaDay } from "@/lib/format";
import { handleError } from "@/lib/http";

export async function GET(request: Request) {
  const admin = await authorizeAdmin(); if (admin instanceof Response) return admin;
  try { return csvResponse(`contactos-alesya-${bogotaDay()}.csv`, toCsv(leadCsvHeader, await exportLeads(leadFiltersFrom(new URL(request.url).searchParams)))); }
  catch (error) { return handleError(error, "crm_export_failed", "No se pudo exportar la base."); }
}
