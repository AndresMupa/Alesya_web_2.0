import { authorizeAdmin } from "@/lib/admin-auth";
import { exportProducts, productCsvHeader } from "@/lib/commerce/products";
import { csvResponse, toCsv } from "@/lib/csv";
import { bogotaDay } from "@/lib/format";
import { handleError } from "@/lib/http";

export async function GET() {
  const admin = await authorizeAdmin(); if (admin instanceof Response) return admin;
  try { return csvResponse(`productos-alesya-${bogotaDay()}.csv`, toCsv(productCsvHeader, await exportProducts())); }
  catch (error) { return handleError(error, "admin_product_export_failed", "No se pudo exportar el catálogo."); }
}
