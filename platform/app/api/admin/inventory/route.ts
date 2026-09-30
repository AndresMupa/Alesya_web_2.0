import { z } from "zod";
import { guardAdmin } from "@/lib/admin-auth";
import { getDb } from "@/db";
import { adjustStock } from "@/lib/inventory";

const schema = z.object({ productId: z.string().uuid(), delta: z.coerce.number().int().min(-10000).max(10000).refine((value) => value !== 0), reason: z.enum(["restock", "adjustment", "damage", "return"]) });

export async function POST(request: Request) {
  const denied = await guardAdmin(request); if (denied) return denied;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "Indica una cantidad distinta de cero y un motivo." }, { status: 400 });
  try {
    if (!await adjustStock(getDb(), parsed.data.productId, parsed.data.delta, parsed.data.reason)) return Response.json({ message: "El producto no existe." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) { console.error("admin_inventory_adjust_failed", error); return Response.json({ message: "No se pudo ajustar el inventario." }, { status: 503 }); }
}
