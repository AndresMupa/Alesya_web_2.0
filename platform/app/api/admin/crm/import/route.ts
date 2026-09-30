import { z } from "zod";
import { authorizeAdmin } from "@/lib/admin-auth";
import { importLeads } from "@/lib/crm/leads";
import { csvRecords } from "@/lib/csv";
import { fail, handleError, ok, readBody } from "@/lib/http";

const schema = z.object({ csv: z.string().min(10).max(8_000_000) });

export async function POST(request: Request) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  const body = await readBody(request, schema, "Adjunta un archivo CSV de hasta 8 MB."); if (body instanceof Response) return body;
  const records = csvRecords(body.csv);
  if (!records.length) return fail("El archivo no tiene filas para importar.");
  if (records.length > 20_000) return fail("Importa como máximo 20.000 contactos por archivo.");
  try { return ok({ ok: true, ...await importLeads(records) }); }
  catch (error) { return handleError(error, "crm_import_failed", "No se pudo importar el archivo."); }
}
