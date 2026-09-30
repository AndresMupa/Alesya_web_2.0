import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { guardAdmin } from "@/lib/admin-auth";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { manualOrderTransitions, type OrderStatus } from "@/lib/statuses";

const schema = z.object({ id: z.string().uuid(), status: z.string().min(1).max(40) });

export async function PATCH(request: Request) {
  const denied = await guardAdmin(request); if (denied) return denied;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "Revisa el estado del pedido." }, { status: 400 });
  const { id, status } = parsed.data;
  try {
    const db = getDb();
    const [order] = await db.select({ status: orders.status }).from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) return Response.json({ message: "El pedido no existe." }, { status: 404 });
    if (!manualOrderTransitions[order.status as OrderStatus]?.includes(status as OrderStatus)) return Response.json({ message: "Ese cambio de estado no está permitido. Los pagos solo se confirman con Wompi." }, { status: 409 });
    const result = await db.update(orders).set({ status, updatedAt: new Date() }).where(and(eq(orders.id, id), eq(orders.status, order.status)));
    if (!result.rowsAffected) return Response.json({ message: "El pedido cambió mientras lo editabas. Actualiza e intenta de nuevo." }, { status: 409 });
    return Response.json({ ok: true });
  } catch (error) { console.error("admin_order_update_failed", error); return Response.json({ message: "No se pudo actualizar el pedido." }, { status: 503 }); }
}
