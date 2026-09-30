import { applyWompiTransaction, verifyWompiEvent, type WompiEvent } from "@/lib/payments/wompi";

/** Eventos firmados de Wompi. Es la única vía por la que un pago en línea cambia de estado. */
export async function POST(request: Request) {
  const secret = process.env.WOMPI_EVENTS_SECRET;
  if (!secret) return Response.json({ message: "Webhook no configurado" }, { status: 503 });
  const body = await request.json().catch(() => null) as WompiEvent | null;
  if (!body?.data || !body.timestamp || !body.signature?.properties?.length) return Response.json({ message: "Evento inválido" }, { status: 400 });
  if (!verifyWompiEvent(body, request.headers.get("x-event-checksum"), secret)) return Response.json({ message: "Firma inválida" }, { status: 401 });
  if (body.event !== "transaction.updated") return Response.json({ ok: true });
  const transaction = body.data.transaction as Record<string, unknown> | undefined;
  try {
    await applyWompiTransaction(transaction);
  } catch (error) {
    console.error("wompi_event_failed", transaction?.reference, error);
    return Response.json({ message: "No se pudo procesar el evento" }, { status: 500 });
  }
  return Response.json({ ok: true });
}
