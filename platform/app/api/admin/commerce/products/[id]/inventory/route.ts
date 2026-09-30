import { z } from "zod";
import { authorizeAdmin } from "@/lib/admin-auth";
import { adjustStock, inventoryHistory } from "@/lib/commerce/inventory";
import { fail, handleError, noStore, ok, readBody } from "@/lib/http";

const uuid = z.string().uuid();
const schema = z.object({ delta: z.coerce.number().int().min(-100_000).max(100_000).refine((value) => value !== 0), reason: z.enum(["restock", "adjustment", "damage", "return", "stock_count"]) });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await authorizeAdmin(); if (admin instanceof Response) return admin;
  const { id } = await params;
  if (!uuid.safeParse(id).success) return fail("Producto no válido.", 404);
  try { return Response.json({ events: await inventoryHistory(id) }, { headers: noStore }); }
  catch (error) { return handleError(error, "admin_inventory_history_failed", "No se pudo cargar el historial."); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  const { id } = await params;
  if (!uuid.safeParse(id).success) return fail("Producto no válido.", 404);
  const body = await readBody(request, schema, "Indica una cantidad distinta de cero y un motivo."); if (body instanceof Response) return body;
  try { return await adjustStock(id, body.delta, body.reason) ? ok() : fail("El producto no existe.", 404); }
  catch (error) { return handleError(error, "admin_inventory_adjust_failed", "No se pudo ajustar el inventario."); }
}
