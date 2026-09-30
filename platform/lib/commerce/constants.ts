// Catálogos del módulo de comercio (estados de pedido y producto, categorías). Seguro para cliente y servidor.

export const orderStatuses = [
  { value: "payment_pending", label: "Pago pendiente" },
  { value: "paid", label: "Pagado" },
  { value: "preparing", label: "En preparación" },
  { value: "shipped", label: "Enviado" },
  { value: "delivered", label: "Entregado" },
  { value: "payment_declined", label: "Pago rechazado" },
  { value: "payment_voided", label: "Pago anulado" },
  { value: "payment_error", label: "Error de pago" },
  { value: "payment_review", label: "Pago en revisión" },
  { value: "cancelled", label: "Cancelado" },
] as const;

export type OrderStatus = (typeof orderStatuses)[number]["value"];

/** Estados que cuentan como venta. */
export const paidOrderStatuses: OrderStatus[] = ["paid", "preparing", "shipped", "delivered"];
/** Estados en los que el pedido todavía no está pagado y admite registrar un pago manual. */
export const unpaidOrderStatuses: OrderStatus[] = ["payment_pending", "payment_declined", "payment_error"];
export const failedOrderStatuses: OrderStatus[] = ["payment_declined", "payment_voided", "payment_error", "cancelled"];

/**
 * Transiciones manuales de preparación. Los estados de pago cambian solo con el webhook firmado de Wompi
 * o cuando el equipo registra un pago manual (transferencia, Nequi directo, efectivo) desde el panel.
 */
export const manualOrderTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
  payment_pending: ["cancelled"],
  payment_declined: ["cancelled"],
  payment_error: ["cancelled"],
  payment_review: ["cancelled"],
  paid: ["preparing"],
  preparing: ["shipped"],
  shipped: ["delivered"],
};

/** Vistas rápidas de la bandeja de pedidos. */
export const orderQueues = [
  { value: "prepare", label: "Por preparar", statuses: ["paid", "preparing"] },
  { value: "unpaid", label: "Esperando pago", statuses: ["payment_pending", "payment_review", "payment_error", "payment_declined"] },
  { value: "shipped", label: "Enviados", statuses: ["shipped"] },
  { value: "closed", label: "Cerrados", statuses: ["delivered", "cancelled", "payment_voided"] },
  { value: "all", label: "Todos", statuses: [] },
] as const satisfies readonly { value: string; label: string; statuses: readonly OrderStatus[] }[];

export const manualPaymentMethods = [
  { value: "TRANSFER", label: "Transferencia bancaria" },
  { value: "NEQUI_DIRECT", label: "Nequi / Daviplata directo" },
  { value: "CASH", label: "Efectivo" },
  { value: "CARD_TERMINAL", label: "Datáfono" },
] as const;
export const manualPaymentMethodValues = manualPaymentMethods.map((method) => method.value) as [string, ...string[]];

export const productStatuses = [
  { value: "active", label: "Publicado" },
  { value: "draft", label: "Borrador" },
  { value: "archived", label: "Archivado" },
] as const;
export type ProductStatus = (typeof productStatuses)[number]["value"];

/** Orden de las columnas del tablero y de los filtros de la tienda. Otras categorías aparecen al final. */
export const categoryOrder = ["Robótica", "Electrónica", "Impresión 3D", "Bricolaje", "Libros"];
export const LOW_STOCK = 5;

export const inventoryReasons: Record<string, string> = {
  initial_stock: "Stock inicial", restock: "Reposición", adjustment: "Ajuste", damage: "Daño o pérdida", return: "Devolución", stock_count: "Conteo físico", sale: "Venta", payment_voided: "Pago anulado", order_cancelled: "Pedido cancelado",
};

/** Eventos de la trazabilidad del pedido. */
export const orderEventLabels: Record<string, string> = {
  created: "Pedido creado", payment_approved: "Pago aprobado", payment_declined: "Pago rechazado", payment_error: "Error de pago", payment_voided: "Pago anulado", payment_review: "Pago en revisión", manual_payment: "Pago manual registrado", status: "Cambio de estado", note: "Nota interna",
};

const labelOf = (list: readonly { value: string; label: string }[], value: string) => list.find((item) => item.value === value)?.label ?? value;
export const orderStatusLabel = (value: string) => labelOf(orderStatuses, value);
export const productStatusLabel = (value: string) => labelOf(productStatuses, value);
export const paymentMethodLabel = (value: string | null) => !value ? "—" : labelOf([...manualPaymentMethods, { value: "NEQUI", label: "Nequi (Wompi)" }, { value: "PSE", label: "PSE" }, { value: "CARD", label: "Tarjeta" }, { value: "BANCOLOMBIA_TRANSFER", label: "Botón Bancolombia" }], value);
export const isPendingStatus = (value: string) => !paidOrderStatuses.includes(value as OrderStatus);

export function sortCategories(categories: Iterable<string>) {
  const present = Array.from(new Set(categories));
  const known = categoryOrder.filter((category) => present.includes(category));
  return [...known, ...present.filter((category) => !categoryOrder.includes(category)).sort((a, b) => a.localeCompare(b, "es"))];
}

/** Disponibilidad que ve el cliente. */
export function stockState(product: { stock: number; backorder: boolean }) {
  if (product.stock > 0) return { purchasable: true, max: product.backorder ? 99 : product.stock, label: product.stock <= LOW_STOCK ? `Últimas ${product.stock} unidades` : "Disponible" };
  if (product.backorder) return { purchasable: true, max: 99, label: "Bajo pedido" };
  return { purchasable: false, max: 0, label: "Agotado" };
}
