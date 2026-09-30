import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { guardAdmin } from "@/lib/admin-auth";
import { getDb } from "@/db";
import { inventoryEvents, products } from "@/db/schema";

const createSchema = z.object({ name: z.string().trim().min(3).max(160), sku: z.string().trim().min(2).max(50), price: z.coerce.number().int().min(0), stock: z.coerce.number().int().min(0), category: z.string().trim().min(2).max(80), description: z.string().trim().min(5).max(1000), imageUrl: z.string().trim().max(500).optional().nullable(), status: z.enum(["active", "draft"]).optional() });
const patchSchema = z.object({ id: z.string().uuid(), name: z.string().trim().min(3).max(160).optional(), price: z.coerce.number().int().min(0).optional(), category: z.string().trim().min(2).max(80).optional(), description: z.string().trim().min(5).max(1000).optional(), imageUrl: z.string().trim().max(500).nullable().optional(), status: z.enum(["active", "draft"]).optional() });

function slugify(value: string) { return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

export async function POST(request: Request) {
  const denied = await guardAdmin(request); if (denied) return denied;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "Revisa los datos del producto." }, { status: 400 });
  const now = new Date(); const id = crypto.randomUUID();
  try {
    const db = getDb();
    const [{ next } = { next: 0 }] = await db.select({ next: sql<number>`coalesce(max(${products.position}), -1) + 1` }).from(products).where(eq(products.category, parsed.data.category));
    await db.batch([
      db.insert(products).values({ id, slug: `${slugify(parsed.data.name)}-${crypto.randomUUID().slice(0, 5)}`, sku: parsed.data.sku.toUpperCase(), name: parsed.data.name, description: parsed.data.description, category: parsed.data.category, priceInCents: parsed.data.price * 100, stock: parsed.data.stock, status: parsed.data.status ?? (parsed.data.price > 0 ? "active" : "draft"), imageUrl: parsed.data.imageUrl || null, position: Number(next), createdAt: now, updatedAt: now }),
      ...(parsed.data.stock ? [db.insert(inventoryEvents).values({ id: crypto.randomUUID(), productId: id, quantityDelta: parsed.data.stock, reason: "initial_stock", createdAt: now })] : []),
    ]);
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) { console.error("admin_product_create_failed", error); return Response.json({ message: "No se pudo crear el producto. Verifica que el SKU sea único." }, { status: 409 }); }
}

export async function PATCH(request: Request) {
  const denied = await guardAdmin(request); if (denied) return denied;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "Revisa los datos del producto." }, { status: 400 });
  const { id, price, imageUrl, ...rest } = parsed.data;
  const changes: Record<string, unknown> = { ...rest, updatedAt: new Date() };
  if (price !== undefined) changes.priceInCents = price * 100;
  if (imageUrl !== undefined) changes.imageUrl = imageUrl || null;
  if (Object.keys(changes).length === 1) return Response.json({ message: "No hay cambios que guardar." }, { status: 400 });
  try {
    const result = await getDb().update(products).set(changes).where(eq(products.id, id));
    if (!result.rowsAffected) return Response.json({ message: "El producto no existe." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) { console.error("admin_product_update_failed", error); return Response.json({ message: "No se pudo actualizar el producto." }, { status: 503 }); }
}
