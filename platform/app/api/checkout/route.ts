import { createHash } from "node:crypto";
import { z } from "zod";
import { getDb } from "@/db";
import { orderItems, orders, payments } from "@/db/schema";
import { findCheckoutProduct } from "@/lib/product-service";
import { enforceRateLimit } from "@/lib/rate-limit";

const checkoutSchema = z.object({ productSlug: z.string().min(1), customer: z.object({ name: z.string().min(2).max(120), email: z.string().email(), phone: z.string().min(7).max(30), city: z.string().min(2).max(100), address: z.string().min(5).max(240), method: z.string().optional() }) });
export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, { name: "checkout", limit: 10, globalLimit: 200, windowMs: 15 * 60_000 });
  if (limited) return limited;
  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "Los datos del pedido no están completos." }, { status: 400 });
  const product = await findCheckoutProduct(parsed.data.productSlug);
  if (product.slug !== parsed.data.productSlug) return Response.json({ message: "Producto no encontrado." }, { status: 404 });
  const orderId = crypto.randomUUID(), paymentId = crypto.randomUUID(), itemId = crypto.randomUUID();
  const reference = `ALESYA-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0,6).toUpperCase()}`, now = new Date();
  try { const db = getDb(); await db.batch([
    db.insert(orders).values({ id:orderId, reference, customerName:parsed.data.customer.name, customerEmail:parsed.data.customer.email, customerPhone:parsed.data.customer.phone, shippingCity:parsed.data.customer.city, shippingAddress:parsed.data.customer.address, subtotalInCents:product.priceInCents, totalInCents:product.priceInCents, status:"payment_pending", createdAt:now, updatedAt:now }),
    db.insert(orderItems).values({ id:itemId, orderId, productSlug:product.slug, productName:product.name, unitPriceInCents:product.priceInCents, lineTotalInCents:product.priceInCents }),
    db.insert(payments).values({ id:paymentId, orderId, reference, status:"pending", amountInCents:product.priceInCents, createdAt:now, updatedAt:now }),
  ]); } catch (error) { console.error("checkout_order_create_failed", error); return Response.json({ message: "No fue posible registrar el pedido." }, { status: 503 }); }
  const publicKey = process.env.WOMPI_PUBLIC_KEY, integritySecret = process.env.WOMPI_INTEGRITY_SECRET;
  if (!publicKey || !integritySecret) return Response.json({ orderReference:reference, message:`Pedido ${reference} registrado. Falta conectar las llaves de Wompi para abrir el cobro real.` });
  const currency = "COP", integrity = createHash("sha256").update(`${reference}${product.priceInCents}${currency}${integritySecret}`).digest("hex"), origin = new URL(request.url).origin;
  const params = new URLSearchParams({ "public-key":publicKey, currency, "amount-in-cents":String(product.priceInCents), reference, "signature:integrity":integrity, "redirect-url":`${origin}/checkout/resultado?referencia=${encodeURIComponent(reference)}`, "customer-data:email":parsed.data.customer.email, "customer-data:full-name":parsed.data.customer.name, "customer-data:phone-number":parsed.data.customer.phone });
  return Response.json({ orderReference:reference, checkoutUrl:`https://checkout.wompi.co/p/?${params.toString()}` });
}
