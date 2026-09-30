import { z } from "zod";
import { eq } from "drizzle-orm";
import { guardAdmin } from "@/lib/admin-auth";
import { getDb } from "@/db";
import { products } from "@/db/schema";

const schema = z.object({ items: z.array(z.object({ id: z.string().uuid(), position: z.coerce.number().int().min(0), category: z.string().trim().min(2).max(80) })).min(1).max(500) });

export async function PATCH(request: Request) {
  const denied = await guardAdmin(request); if (denied) return denied;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "Orden no válido." }, { status: 400 });
  const now = new Date();
  try {
    const db = getDb();
    await db.batch(parsed.data.items.map((item) => db.update(products).set({ position: item.position, category: item.category, updatedAt: now }).where(eq(products.id, item.id))));
    return Response.json({ ok: true });
  } catch (error) { console.error("admin_product_reorder_failed", error); return Response.json({ message: "No se pudo guardar el nuevo orden." }, { status: 503 }); }
}
