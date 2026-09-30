import { z } from "zod";
import { authorizeAdmin } from "@/lib/admin-auth";
import { manualPaymentMethodValues, orderStatuses, type OrderStatus } from "@/lib/commerce/constants";
import { confirmManualPayment, getOrderDetail, transitionOrder, updateOrderNotes } from "@/lib/commerce/orders";
import { fail, handleError, noStore, ok, readBody } from "@/lib/http";

const uuid = z.string().uuid();
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), status: z.enum(orderStatuses.map((status) => status.value) as [OrderStatus, ...OrderStatus[]]), detail: z.string().trim().max(300).default("") }),
  z.object({ action: z.literal("manual_payment"), method: z.enum(manualPaymentMethodValues), note: z.string().trim().max(300).default("") }),
  z.object({ action: z.literal("notes"), internalNotes: z.string().max(4000) }),
]);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await authorizeAdmin(); if (admin instanceof Response) return admin;
  const { id } = await params;
  if (!uuid.safeParse(id).success) return fail("Pedido no válido.", 404);
  try {
    const detail = await getOrderDetail(id);
    return detail ? Response.json(detail, { headers: noStore }) : fail("El pedido no existe.", 404);
  } catch (error) { return handleError(error, "admin_order_detail_failed", "No se pudo cargar el pedido."); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  const { id } = await params;
  if (!uuid.safeParse(id).success) return fail("Pedido no válido.", 404);
  const body = await readBody(request, schema, "Revisa la acción sobre el pedido."); if (body instanceof Response) return body;
  try {
    if (body.action === "status") await transitionOrder(id, body.status, admin.email, body.detail);
    else if (body.action === "manual_payment") await confirmManualPayment(id, body, admin.email);
    else await updateOrderNotes(id, body.internalNotes);
    return ok();
  } catch (error) { return handleError(error, "admin_order_update_failed", "No se pudo actualizar el pedido."); }
}
