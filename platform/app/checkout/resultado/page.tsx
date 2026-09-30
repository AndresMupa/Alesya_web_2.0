import Link from "next/link";
import { eq } from "drizzle-orm";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { paidOrderStatuses, type OrderStatus } from "@/lib/statuses";

export const dynamic = "force-dynamic";
export const metadata = { title: "Estado del pago | Alesya", robots: { index: false, follow: false } };

async function findStatus(reference?: string) {
  if (!reference || reference.length > 80) return null;
  try {
    const [order] = await getDb().select({ status: orders.status }).from(orders).where(eq(orders.reference, reference)).limit(1);
    return order?.status ?? null;
  } catch (error) { console.error("checkout_result_lookup_failed", error); return null; }
}

export default async function ResultPage({ searchParams }: { searchParams: Promise<{ referencia?: string }> }) {
  const { referencia } = await searchParams;
  const status = await findStatus(referencia);
  const paid = !!status && paidOrderStatuses.includes(status as OrderStatus);
  const failed = !!status && ["payment_declined", "payment_voided", "payment_error", "cancelled"].includes(status);
  const Icon = paid ? CheckCircle2 : failed ? XCircle : Clock3;
  const title = paid ? "¡Pago confirmado!" : failed ? "El pago no se completó" : "Estamos verificando tu pago";
  const copy = paid ? "Recibimos la confirmación de Wompi. Te contactaremos para coordinar la entrega." : failed ? "Wompi no aprobó la transacción. Puedes intentarlo de nuevo con otro medio de pago o escribirnos si necesitas ayuda." : "Wompi nos enviará la confirmación segura en unos segundos. Puedes recargar esta página para ver el estado actualizado.";
  return <main className="checkout-page" style={{ display: "grid", placeItems: "center", padding: 24 }}>
    <section className="checkout-card" style={{ maxWidth: 560, textAlign: "center" }}>
      <Icon size={54} style={{ margin: "0 auto 18px", color: paid ? "#278250" : failed ? "#b3261e" : "#855f00" }} />
      <h1>{title}</h1>
      <p>{copy}</p>
      <p>Referencia del pedido: <strong>{referencia ?? "—"}</strong></p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 20 }}>
        {failed && <Link href="/catalogo" className="button button-primary">Volver a la tienda</Link>}
        <Link href="/" className="button button-dark">Volver a Alesya</Link>
      </div>
    </section>
  </main>;
}
