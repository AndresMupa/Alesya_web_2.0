import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { products } from "@/db/schema";

export async function GET() {
  try {
    const rows = await getDb().select({ slug: products.slug, name: products.name, description: products.description, category: products.category, priceInCents: products.priceInCents, stock: products.stock }).from(products).where(and(eq(products.status, "active"))).orderBy(desc(products.createdAt)).limit(24);
    return Response.json({ products: rows });
  } catch (error) {
    console.error("public_products_failed", error);
    return Response.json({ products: [] }, { status: 503 });
  }
}
