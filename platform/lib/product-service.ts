import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import { featuredProducts, getProduct } from "@/lib/catalog";

export type CheckoutProduct = {
  slug: string;
  name: string;
  description: string;
  price: string;
  priceInCents: number;
};

const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export async function findCheckoutProduct(slug?: string | null): Promise<CheckoutProduct> {
  const staticProduct = featuredProducts.find((product) => product.slug === slug);
  if (staticProduct) return staticProduct;
  if (slug) {
    try {
      const [product] = await getDb().select({ slug: products.slug, name: products.name, description: products.description, priceInCents: products.priceInCents }).from(products).where(eq(products.slug, slug)).limit(1);
      if (product) return { ...product, price: money.format(product.priceInCents / 100) };
    } catch (error) {
      console.error("product_lookup_failed", error);
    }
  }
  return getProduct();
}
