export const leadStages = [
  { value: "new", label: "Nuevo" },
  { value: "contacted", label: "Contactado" },
  { value: "proposal", label: "Propuesta" },
  { value: "won", label: "Ganado" },
  { value: "lost", label: "Perdido" },
] as const;

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

export type LeadStage = (typeof leadStages)[number]["value"];
export type OrderStatus = (typeof orderStatuses)[number]["value"];

/** Order states that count as revenue. */
export const paidOrderStatuses: OrderStatus[] = ["paid", "preparing", "shipped", "delivered"];

/** Manual fulfilment transitions. Payment states only change through the signed Wompi webhook. */
export const manualOrderTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
  payment_pending: ["cancelled"],
  payment_declined: ["cancelled"],
  payment_error: ["cancelled"],
  payment_review: ["cancelled"],
  paid: ["preparing"],
  preparing: ["shipped"],
  shipped: ["delivered"],
};

export const leadStageLabel = (value: string) => leadStages.find((stage) => stage.value === value)?.label ?? value;
export const orderStatusLabel = (value: string) => orderStatuses.find((status) => status.value === value)?.label ?? value;
export const isPendingStatus = (value: string) => !["paid", "preparing", "shipped", "delivered", "won"].includes(value);
