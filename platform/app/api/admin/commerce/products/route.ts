import { z } from "zod";
import { authorizeAdmin } from "@/lib/admin-auth";
import { createProduct, listAdminProducts, updateProduct } from "@/lib/commerce/products";
import { handleError, noStore, ok, readBody } from "@/lib/http";

// Imagen: ruta propia (/media/…, /uploads/…) o URL https.
const imageUrl = z.string().trim().max(500).refine((value) => value === "" || /^\/(media|uploads)\/[\w\-./]+$/.test(value) || /^https:\/\/[^\s"'<>]+$/.test(value), "Imagen no válida").nullable();
const status = z.enum(["active", "draft", "archived"]);

const createSchema = z.object({
  name: z.string().trim().min(3).max(160), sku: z.string().trim().min(2).max(50), price: z.coerce.number().int().min(0).max(1_000_000_000),
  stock: z.coerce.number().int().min(0).max(100_000), category: z.string().trim().min(2).max(80), description: z.string().trim().min(5).max(1000),
  imageUrl: imageUrl.optional(), status: status.optional(), featured: z.boolean().optional(), backorder: z.boolean().optional(),
});
const patchSchema = z.object({
  id: z.string().uuid(), name: z.string().trim().min(3).max(160).optional(), sku: z.string().trim().min(2).max(50).optional(), price: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
  category: z.string().trim().min(2).max(80).optional(), description: z.string().trim().min(5).max(1000).optional(), imageUrl: imageUrl.optional(), status: status.optional(),
  featured: z.boolean().optional(), backorder: z.boolean().optional(),
});

export async function GET() {
  const admin = await authorizeAdmin(); if (admin instanceof Response) return admin;
  try { return Response.json({ products: await listAdminProducts() }, { headers: noStore }); }
  catch (error) { return handleError(error, "admin_products_list_failed", "No se pudo cargar el catálogo."); }
}

export async function POST(request: Request) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  const body = await readBody(request, createSchema, "Revisa los datos del producto."); if (body instanceof Response) return body;
  const { price, ...input } = body;
  try { return ok({ ok: true, id: await createProduct({ ...input, priceInCents: price * 100 }) }, 201); }
  catch (error) { return handleError(error, "admin_product_create_failed", "No se pudo crear el producto."); }
}

export async function PATCH(request: Request) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  const body = await readBody(request, patchSchema, "Revisa los datos del producto."); if (body instanceof Response) return body;
  const { id, price, ...patch } = body;
  try { await updateProduct(id, { ...patch, ...(price !== undefined && { priceInCents: price * 100 }) }); return ok(); }
  catch (error) { return handleError(error, "admin_product_update_failed", "No se pudo actualizar el producto."); }
}
