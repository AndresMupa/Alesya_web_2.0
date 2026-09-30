import { z } from "zod";
import { authorizeAdmin } from "@/lib/admin-auth";
import { importProducts } from "@/lib/commerce/products";
import { csvRecords } from "@/lib/csv";
import { fail, handleError, ok, readBody } from "@/lib/http";

const schema = z.object({ csv: z.string().min(10).max(4_000_000), updateStock: z.boolean().default(false) });

export async function POST(request: Request) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  const body = await readBody(request, schema, "Adjunta un archivo CSV de hasta 4 MB."); if (body instanceof Response) return body;
  const records = csvRecords(body.csv);
  if (!records.length) return fail("El archivo no tiene filas para importar.");
  if (records.length > 5000) return fail("Importa como máximo 5.000 productos por archivo.");
  try { return ok({ ok: true, ...await importProducts(records, { updateStock: body.updateStock }) }); }
  catch (error) { return handleError(error, "admin_product_import_failed", "No se pudo importar el archivo."); }
}
